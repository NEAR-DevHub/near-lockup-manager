# Technical reference for AI agents

This document is the primary orientation guide for any AI agent working on this repo. Read it end-to-end before making changes — it encodes non-obvious invariants about the NEAR lockup contract, the libraries in use, and the pitfalls that have already been worked through.

---

## 1. What this app is

A Next.js 16 (App Router) single-page dApp that lets the **owner of a NEAR lockup contract** manage it from a browser:

1. View a balance breakdown that is **provably equal to on-chain reality** (not the stale contract view).
2. Delegate stake through the lockup: select a whitelisted pool, `deposit_and_stake`, `unstake`, `withdraw_from_staking_pool`, `refresh_staking_pool_balance`.
3. Transfer liquid tokens out of the lockup (with a conditional `refresh_staking_pool_balance` batched into the same transaction if needed).
4. Delete the lockup account, sending residual NEAR to the owner.

Mainnet only; the lockup factory is hard-coded to `lockup.near`.

---

## 2. How the lockup contract works (the parts this app touches)

Canonical sources:
- https://github.com/near/core-contracts/tree/master/lockup — the lockup contract (Rust source).
- https://github.com/near/core-contracts/tree/master/lockup-factory — the factory that creates lockup accounts.

### 2.1 Lockup account ID derivation

From [`lockup-factory/src/lib.rs`](https://github.com/near/core-contracts/blob/master/lockup-factory/src/lib.rs) `create()`:

```
lockup_account_id = hex(sha256(owner_account_id)[..20]) + "." + factory_account_id
```

On mainnet the factory is `lockup.near`, so the lockup account is
`{40-hex-chars}.lockup.near`. This is implemented in `src/lib/near.ts → deriveLockupAccountId`.

### 2.2 Public view methods we use

| Method | Returns | Notes |
|---|---|---|
| `get_owner_account_id()` | `AccountId` | Sanity check. |
| `get_staking_pool_account_id()` | `Option<AccountId>` | `null` means no pool selected. |
| `get_known_deposited_balance()` | `U128` | **Cached** — see §2.3. |
| `get_locked_amount()` | `U128` | Tokens locked by lockup+vesting schedule right now. |
| `get_balance()` | `U128` | `env::account_balance() + known_deposited_balance`. **Stale.** |
| `get_owners_balance()` | `U128` | `get_balance() - get_locked_amount()` (saturating). **Stale.** |
| `get_liquid_owners_balance()` | `U128` | `min(get_owners_balance(), get_account_balance())` where `get_account_balance() = env::account_balance() - MIN_BALANCE_FOR_STORAGE`. **Used by the contract's `transfer` assertion.** |
| `are_transfers_enabled()` | `bool` | Controlled by the foundation's transfer poll. |
| `get_vesting_information()` | `VestingInformation` | `"None" \| { VestingHash } \| { VestingSchedule } \| { Terminating }`. |
| `get_termination_status()` | `Option<TerminationStatus>` | `null` ↔ no termination in progress. |

### 2.3 The stale-cache gotcha (critical)

`known_deposited_balance` is **only** updated by callbacks from staking-pool operations: `deposit_and_stake`, `unstake`, `withdraw_from_staking_pool`, `refresh_staking_pool_balance`, etc. While rewards accrue at the pool, the lockup contract's view of the deposit does **not** change. Consequences:

- `get_balance()`, `get_owners_balance()`, `get_liquid_owners_balance()` all understate the real balance by the accrued rewards.
- For the test account `70e8...eae67`, `get_balance()` was **4,303 NEAR off** from reality.
- The contract's `transfer()` uses the stale `get_liquid_owners_balance()` internally for its assertion, so batching `refresh_staking_pool_balance` before `transfer` in one transaction is how you enlarge the liquid balance cap (see §4.4).

**Never display these stale values as if they were reality.** Always compute totals from on-chain balance + actual staking pool balance (`get_account` on the pool).

### 2.4 Staking delegation through the lockup

All staking ops are called on the **lockup contract**, not the pool. The lockup re-dispatches to the pool via cross-contract calls and updates its own `StakingInformation.deposit_amount` via callbacks. Key methods and gas budgets:

| Method | TGas | Constraint |
|---|---|---|
| `select_staking_pool(staking_pool_account_id)` | 75 | Must not already have a pool; pool is checked against the whitelist. |
| `unselect_staking_pool()` | 25 | `deposit_amount == 0`. |
| `deposit_and_stake(amount)` | 125 | `get_account_balance() >= amount` (i.e. on-chain − 3.5 NEAR). |
| `stake(amount)` | 125 | Requires prior `deposit`. |
| `unstake(amount)` | 125 | |
| `unstake_all()` | 125 | |
| `withdraw_from_staking_pool(amount)` | 125 | |
| `withdraw_all_from_staking_pool()` | 175 | |
| `refresh_staking_pool_balance()` | 75 | Re-queries pool and updates `known_deposited_balance`. |
| `transfer(amount, receiver_id)` | 50 | `get_liquid_owners_balance() >= amount`, transfers enabled, no termination, `assert_no_staking_or_idle`. |
| `add_full_access_key(new_public_key)` | 50 | See §3. |

All of the above (except `transfer` and `add_full_access_key`) set `StakingInformation.status = Busy` and rely on a callback to reset it to `Idle`. Most assertions that guard these methods include `assert_staking_pool_is_idle()` — you cannot batch two pool-dispatching calls in the same transaction.

### 2.5 The `MIN_BALANCE_FOR_STORAGE` reserve

`pub const MIN_BALANCE_FOR_STORAGE: u128 = 3_500_000_000_000_000_000_000_000;` (3.5 NEAR). This is reserved by the contract for its own storage. The contract never lets the owner access it, and the factory initializes the lockup with at least this much headroom. It is only recoverable by deleting the lockup account, which makes the beneficiary of `DeleteAccount` receive this (minus storage staking) as part of the return payment.

---

## 3. Prerequisites for `add_full_access_key` (and lockup removal)

From [`lockup/src/owner.rs::add_full_access_key`](https://github.com/near/core-contracts/blob/master/lockup/src/owner.rs):

```rust
self.assert_owner();
self.assert_transfers_enabled();
self.assert_no_staking_or_idle();
self.assert_no_termination();
assert_eq!(self.get_locked_amount().0, 0, "Tokens are still locked/unvested");
```

Translation:

1. **Transfers enabled** — `are_transfers_enabled() == true`. Note: transfers were enabled **globally** on NEAR mainnet in October 2020 and cannot be disabled again. Any lockup contract that still reports `are_transfers_enabled() == false` simply has the stale cached `TransfersInformation::TransfersDisabled { transfer_poll_account_id }` from before the poll resolved. The owner syncs it with a single `check_transfers_vote()` call (75 TGas); the contract queries the transfer-poll contract, and the callback updates the cached state to `TransfersEnabled`. The UI surfaces this inline: any prerequisite/guard that requires transfers offers a "Call check_transfers_vote" button instead of implying the user must wait.
2. **Staking pool idle** — if one is selected, its `status` must be `Idle` (no in-flight operation). There is no public view method for this — the only way to observe it client-side is indirectly (any pool-dispatching call will fail with `"Contract is currently busy..."`).
3. **No termination** — `get_termination_status() == null`.
4. **Fully vested/released** — `get_locked_amount() == 0`.

The app also enforces two **practical** prerequisites not required by the contract but required for safety:

5. **`pool_staked == 0`** — otherwise those tokens are left credited to a deleted account at the pool and become **permanently inaccessible**.
6. **`pool_unstaked == 0`** — same reason, plus the unstaking delay (~48h / 4 epochs).

All six are shown as a live checklist in `src/components/RemoveLockup.tsx::useRemovalPrerequisites`. The "Begin Lockup Removal" button is disabled until every row is green.

---

## 4. How the key flows are implemented

### 4.1 Balance breakdown (source of truth for everything displayed)

Implemented once in `src/hooks/useLockupBreakdown.ts`. Pulls:

- On-chain `accountInfo.balance.total.yoctoNear` via `useAccountInfo({ accountId: lockupAccountId })`.
- `get_locked_amount()` via `useLockupLockedAmount`.
- `get_staking_pool_account_id()` via `useLockupStakingPool`.
- `get_account(lockupAccountId)` **on the staking pool** via `useStakingPoolAccount` → `staked_balance`, `unstaked_balance`, `can_withdraw`.

Computes the 4-category breakdown plus total:

```
total            = on_chain + pool_staked + pool_unstaked
pool_unstaked_pending = can_withdraw ? 0 : pool_unstaked
afterUnstake     = pool_staked + pool_unstaked_pending
availableNow     = max(0, total − locked − 3.5 NEAR − afterUnstake)

total == locked + 3.5 NEAR + availableNow + afterUnstake   (invariant)
```

The "Locked for smart contract" row is literally the 3.5 NEAR constant; it is only reclaimable by deleting the lockup. The "available after unstake" row is hidden when zero.

Consumers: `LockupInfo.tsx`, `TransferForm.tsx`, `StakingManagement.tsx` (max-stakeable), `RemoveLockup.tsx` (prereq checklist).

### 4.2 Staking UI (`components/StakingManagement.tsx`)

- If no pool is selected, a form to call `select_staking_pool` is shown.
- Once a pool is selected, three tabs (`Stake / Unstake / Withdraw`) operate against it.
- **Stake max** is `on_chain − MIN_BALANCE_FOR_STORAGE`, not `get_owners_balance()`. The contract's assertion on `deposit_and_stake` is against `get_account_balance()`, which is exactly that. Using the stale owner's balance was wildly wrong for accounts with pool rewards.
- A `refresh_staking_pool_balance` button is shown in the card header.
- `unselect_staking_pool` is offered only when both `staked_balance == 0` and `unstaked_balance == 0`.

### 4.3 Transfer flow (`components/TransferForm.tsx` + `useTransferFromLockup`)

- Max input is clamped to `availableNow` from the breakdown hook.
- `useCachedLiquidBalance` reads `get_liquid_owners_balance()` — the **cached** limit the contract itself will use in its `transfer` assertion.
- The transfer is sent as a **plain single-action transaction** — just `functionCall("transfer", { amount, receiver_id })` at 50 TGas.
- **Two-step flow when `amount > cachedLiquid`.** The contract's `transfer` assertion reads `get_liquid_owners_balance()`, which depends on the cached `known_deposited_balance`. That cache is only updated by the callback of `refresh_staking_pool_balance`. Because `refresh_staking_pool_balance` is a cross-contract call (it queries the staking pool and runs its state-updating callback in a *later* receipt), batching `refresh → transfer` in one transaction does **not** work: actions in a single transaction execute in one receipt, so the `transfer` action runs before the refresh's callback has committed. Worse, `refresh_staking_pool_balance` flips `StakingInformation.status` to `Busy` up front, which makes the immediately-following `transfer` fail `assert_no_staking_or_idle` anyway.
- **So the UI enforces two sequential transactions:** when `amount > cachedLiquid`, the Transfer button is disabled and an inline "Call refresh_staking_pool_balance" button is shown. After that transaction finalizes, `invalidateLockupQueries` refetches `get_liquid_owners_balance` and `get_known_deposited_balance`, which makes `needsRefresh` flip to `false` and re-enables the Transfer button.
- On success, the transfer hook invalidates `get_liquid_owners_balance` and `getAccountInfo` so the UI reflects the new state.

### 4.4 Remove lockup (`components/RemoveLockup.tsx`)

Three-step flow, each requiring an explicit user action:

1. **Sign message** — `useSignMessage` (react-near-ts) with `createMessage({ message, recipient: lockupAccountId })`. The returned `SignedMessage.signerPublicKey` is the owner's public key; we keep it for the next step. This is the *only* way to learn the owner's public key from a wallet without assuming `near-api-js`-style key access.
2. **Batch add_full_access_key × 2** — one transaction, two `functionCall` actions, each adding a full access key to the lockup contract: (a) the owner's public key (backup), (b) a fresh `randomEd25519KeyPair()` generated in the browser. Private key is stored in a `useRef` (never in `useState`) so it doesn't trigger renders and never leaves memory except to be used once.
3. **Delete account** — the temporary key is used to build a `MemorySigner` (`createMemoryKeyService` + `createMemorySigner`) that signs a `deleteAccount({ beneficiaryAccountId: ownerAccountId })` transaction on the lockup account. This does not go through the connected wallet — the temporary key now has full access, so we sign and broadcast directly.

The owner key is added as a **backup**: if anything goes wrong between steps 2 and 3, the owner can still reach the lockup using their own wallet.

The entire flow is gated behind the prerequisites checklist from §3.

---

## 5. Library specifics (react-near-ts / near-api-ts)

**Required reading:** the NEAR dApp best-practices guide (available in the `near-dapp-best-practices` skill/agent bundle, or upstream with the `react-near-ts` package docs). Everything below is a distilled subset, focused on gotchas that have already been hit in this codebase.

### 5.1 Provider setup (already done in `src/app/providers.tsx`)

```ts
const nearStore = createNearStore({
  networkId: "mainnet",
  clientCreator: createMainnetClient,
  serviceCreator: createNearConnectorService({}),
});
```

`NearProvider` already provides a `QueryClient`. **Do not wrap in another `QueryClientProvider`** — duplicated providers silently break invalidation.

### 5.2 Reading contract state

`useContractReadFunction` returns `UseQueryResult<CallContractReadFunctionOutput<T>>`. **Access via `.data?.result`**, not `.data?.<field>`:

```ts
const account = useStakingPoolAccount(poolId, lockupId);
account.data?.result.staked_balance   // ✓
account.data?.staked_balance          // ✗ wrong
```

Query keys for invalidation follow the pattern
`["callContractReadFunction", contractAccountId, functionName]`.

Deserializers we use:
- `deserializeU128` — JSON `"123..."` string passthrough.
- `deserializeBool`, `deserializeString`, `deserializeOptionalString`.
- Zod schemas via `z/mini` for structured results (e.g. `VestingInfoSchema`, `AccountSchema`).

### 5.3 Writing transactions

`useExecuteTransaction` returns `{ executeTransaction, executeTransactionAsync, isPending, isError, error, isSuccess, data }`. The intent shape is:

```ts
{
  intent: {
    receiverAccountId: "...",
    action: functionCall({ functionName, functionArgs, gasLimit: { teraGas: "50" }, attachedDeposit?: { near: "..." } }),
    // OR for multi-action:
    // actions: [functionCall(...), functionCall(...)]
  },
  mutate?: { onSuccess, onError, ... }
}
```

Gotchas:
- The field is **`attachedDeposit`**, not `deposit`.
- Use `BigInt(1000)` not `1000n` (Turbopack/ES2020 issue for older browsers).
- Action builders `functionCall`, `addFullAccessKey`, `deleteAccount`, etc. are re-exported from `react-near-ts` (originally from `near-api-ts`).

### 5.4 Account info

`useAccountInfo({ accountId })` returns `UseQueryResult<GetAccountInfoOutput>`. **No `.result` wrapper** — `data` is the output directly. `data.accountInfo.balance.total.yoctoNear` is a `bigint`, so `.toString()` it before passing to UI helpers that expect strings.

### 5.5 Sign message

```ts
const { signMessageAsync } = useSignMessage();
const message = createMessage({ message: "...", recipient: "..." });
const { signerAccountId, signerPublicKey, signature, message: signedMsg } = await signMessageAsync({ message });
```

`signerPublicKey: PublicKey` is a branded `Ed25519CurveString | Secp256k1CurveString`. Pass it as a JSON arg directly — the lockup contract accepts it as a `Base58PublicKey` string.

### 5.6 Generating and using temporary keys

```ts
import { randomEd25519KeyPair, createMemoryKeyService, createMemorySigner, createMainnetClient } from "react-near-ts";

const kp = randomEd25519KeyPair();
// kp.publicKey: Ed25519PublicKey, kp.privateKey: Ed25519PrivateKey (branded)
// DO NOT convert to plain string — the API's PrivateKey type is branded.

const signer = createMemorySigner({
  signerAccountId: lockupAccountId,
  client: createMainnetClient(),
  keyService: createMemoryKeyService({ keySource: { privateKey: kp.privateKey } }),
});

await signer.executeTransaction({ intent: { receiverAccountId, action: deleteAccount({ beneficiaryAccountId }) } });
```

If you ever see a TS error about `string` not assignable to `PrivateKey`, you're probably trying to persist a key via `useState<string>()`. Don't — keep `PrivateKey` in a `useRef` as its branded type.

### 5.7 Query invalidation

After any successful mutation that changes state you display, invalidate:

- Contract reads: `["callContractReadFunction", contractId, functionName]`
- Account info: `["getAccountInfo", accountId]`

The app already does this in every mutation hook. If you add a new mutation, add corresponding invalidations, or the UI will show stale data until a full refresh.

---

## 6. File map

```
src/
├── app/
│   ├── layout.tsx                   # Html shell + <Providers>
│   ├── providers.tsx                # NearProvider on mainnet
│   ├── page.tsx                     # Landing: connect wallet or look up owner
│   ├── globals.css                  # Tailwind v4 + shadcn theme
│   └── [ownerAccountId]/page.tsx    # Owner dashboard (derives lockup id via deriveLockupAccountId)
├── components/
│   ├── Header.tsx / Footer.tsx / NearIcon.tsx
│   ├── LockupInfo.tsx               # Balance breakdown card (reads useLockupBreakdown)
│   ├── TransferForm.tsx             # Withdraw-to-owner flow (§4.3)
│   ├── StakingManagement.tsx        # Select pool + Stake/Unstake/Withdraw tabs
│   ├── RemoveLockup.tsx             # Prerequisites checklist + 3-step removal flow
│   └── ui/                          # shadcn components (do not edit by hand)
├── hooks/
│   ├── useLockup.ts                 # View methods on the lockup contract
│   ├── useLockupStaking.ts          # Staking delegation mutations + transfer w/ conditional refresh
│   └── useLockupBreakdown.ts        # Shared balance math (§4.1) — the single source of truth
└── lib/
    ├── near.ts                      # formatNearAmount, parseNearToYocto, deriveLockupAccountId
    └── utils.ts                     # shadcn cn()
```

---

## 7. Invariants & conventions

- **Never use `parseInt/parseFloat/Number()` on yoctoNEAR strings.** Always `BigInt()`.
- **Never trust `get_balance` / `get_owners_balance` / `get_liquid_owners_balance` as reality.** They're cache-backed. Display real balances from on-chain + pool. The cached value is only meaningful as the contract's current `transfer()` limit — surface it as such (`TransferForm` calls it the "cached liquid balance").
- **Every balance displayed must be accompanied by a label that makes its source unambiguous.** "Total balance", "Locked", "Available for withdrawal now", etc. — not generic "balance".
- **The 4-category overview is an invariant:** `total == locked + 3.5 + availableNow + afterUnstake`. If you add a row, make sure this still holds.
- **Max-stakeable = on-chain − 3.5 NEAR**, full stop. Not owner's balance, not liquid owner's balance.
- **The "Remove Lockup" button must never be enabled while pool balances are non-zero**, even if the contract would accept `add_full_access_key`. Staked tokens at the pool are lost on deletion.
- **All owner-gated UI must be hidden (not just disabled) when `useConnectedAccount().connectedAccountId !== ownerAccountId`.** Look-up mode is read-only by design.
- **shadcn components in `components/ui/`** are generated — don't hand-edit. If you need changes, re-run the generator or wrap the component.
- **Gas budgets** in `useLockupStaking.ts` come from [`lockup/src/gas.rs`](https://github.com/near/core-contracts/blob/master/lockup/src/gas.rs). If you change them, cross-check against the contract to avoid `GasExceeded` errors.

---

## 8. When in doubt

1. Check https://github.com/near/core-contracts/tree/master/lockup — every assertion in the lockup contract is a UX requirement in the app.
2. Check the NEAR dApp best-practices guide — the canonical reference for how to use `react-near-ts`.
3. Verify balance logic by querying mainnet RPC directly (e.g. with `curl https://rpc.mainnet.near.org` and the `call_function` / `view_account` request types) and comparing against what the UI shows. The balance breakdown must always sum to the same total as on-chain reality.
