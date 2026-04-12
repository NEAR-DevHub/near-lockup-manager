"use client";

import {
  type DeserializeResultFnArgs,
  fromJsonBytes,
  useContractReadFunction,
  useExecuteTransaction,
  functionCall,
} from "react-near-ts";
import * as z from "zod/mini";

const AccountSchema = z.object({
  account_id: z.string(),
  unstaked_balance: z.string(),
  staked_balance: z.string(),
  can_withdraw: z.boolean(),
});

type StakingAccount = z.infer<typeof AccountSchema>;

const deserializeAccount = (args: DeserializeResultFnArgs): StakingAccount =>
  AccountSchema.parse(fromJsonBytes(args.rawResult));

const deserializeBool = (args: DeserializeResultFnArgs): boolean =>
  Boolean(fromJsonBytes(args.rawResult));

export function useStakingPoolAccount(
  poolId: string,
  lockupAccountId: string
) {
  return useContractReadFunction({
    contractAccountId: poolId,
    functionName: "get_account",
    functionArgs: { account_id: lockupAccountId },
    options: { deserializeResult: deserializeAccount },
    query: { enabled: poolId.length > 0 && lockupAccountId.length > 0 },
  });
}

export function useIsPoolWhitelisted(
  whitelistAccountId: string,
  poolId: string
) {
  return useContractReadFunction({
    contractAccountId: whitelistAccountId,
    functionName: "is_whitelisted",
    functionArgs: { staking_pool_account_id: poolId },
    options: { deserializeResult: deserializeBool },
    query: {
      enabled:
        whitelistAccountId.length > 0 &&
        poolId.length > 0,
    },
  });
}

function invalidateLockupQueries(
  lockupAccountId: string,
  poolId: string,
  context: { client: { invalidateQueries: (args: { queryKey: string[] }) => Promise<void> } }
) {
  void context.client.invalidateQueries({
    queryKey: ["callContractReadFunction", lockupAccountId, "get_known_deposited_balance"],
  });
  void context.client.invalidateQueries({
    queryKey: ["callContractReadFunction", lockupAccountId, "get_balance"],
  });
  void context.client.invalidateQueries({
    queryKey: ["callContractReadFunction", lockupAccountId, "get_owners_balance"],
  });
  void context.client.invalidateQueries({
    queryKey: ["callContractReadFunction", lockupAccountId, "get_liquid_owners_balance"],
  });
  void context.client.invalidateQueries({
    queryKey: ["callContractReadFunction", lockupAccountId, "get_locked_amount"],
  });
  void context.client.invalidateQueries({
    queryKey: ["callContractReadFunction", lockupAccountId, "get_staking_pool_account_id"],
  });
  void context.client.invalidateQueries({
    queryKey: ["callContractReadFunction", poolId, "get_account"],
  });
}

export function useSelectStakingPool(lockupAccountId: string) {
  const mutation = useExecuteTransaction();

  return {
    selectPool: (stakingPoolAccountId: string) => {
      mutation.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: functionCall({
            functionName: "select_staking_pool",
            functionArgs: {
              staking_pool_account_id: stakingPoolAccountId,
            },
            gasLimit: { teraGas: "75" },
          }),
        },
        mutate: {
          onSuccess: (_data, _variables, _onMutateResult, context) => {
            void context.client.invalidateQueries({
              queryKey: [
                "callContractReadFunction",
                lockupAccountId,
                "get_staking_pool_account_id",
              ],
            });
          },
        },
      });
    },
    ...mutation,
  };
}

export function useUnselectStakingPool(lockupAccountId: string) {
  const mutation = useExecuteTransaction();

  return {
    unselectPool: () => {
      mutation.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: functionCall({
            functionName: "unselect_staking_pool",
            functionArgs: {},
            gasLimit: { teraGas: "25" },
          }),
        },
        mutate: {
          onSuccess: (_data, _variables, _onMutateResult, context) => {
            void context.client.invalidateQueries({
              queryKey: [
                "callContractReadFunction",
                lockupAccountId,
                "get_staking_pool_account_id",
              ],
            });
          },
        },
      });
    },
    ...mutation,
  };
}

export function useDepositAndStake(
  lockupAccountId: string,
  poolId: string
) {
  const mutation = useExecuteTransaction();

  return {
    depositAndStake: (amountYocto: string) => {
      mutation.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: functionCall({
            functionName: "deposit_and_stake",
            functionArgs: { amount: amountYocto },
            gasLimit: { teraGas: "125" },
          }),
        },
        mutate: {
          onSuccess: (_data, _variables, _onMutateResult, context) => {
            invalidateLockupQueries(lockupAccountId, poolId, context);
          },
        },
      });
    },
    ...mutation,
  };
}

export function useUnstake(lockupAccountId: string, poolId: string) {
  const mutation = useExecuteTransaction();

  return {
    unstake: (amountYocto: string) => {
      mutation.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: functionCall({
            functionName: "unstake",
            functionArgs: { amount: amountYocto },
            gasLimit: { teraGas: "125" },
          }),
        },
        mutate: {
          onSuccess: (_data, _variables, _onMutateResult, context) => {
            invalidateLockupQueries(lockupAccountId, poolId, context);
          },
        },
      });
    },
    ...mutation,
  };
}

export function useUnstakeAll(lockupAccountId: string, poolId: string) {
  const mutation = useExecuteTransaction();

  return {
    unstakeAll: () => {
      mutation.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: functionCall({
            functionName: "unstake_all",
            functionArgs: {},
            gasLimit: { teraGas: "125" },
          }),
        },
        mutate: {
          onSuccess: (_data, _variables, _onMutateResult, context) => {
            invalidateLockupQueries(lockupAccountId, poolId, context);
          },
        },
      });
    },
    ...mutation,
  };
}

export function useWithdrawFromStakingPool(
  lockupAccountId: string,
  poolId: string
) {
  const mutation = useExecuteTransaction();

  return {
    withdraw: (amountYocto: string) => {
      mutation.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: functionCall({
            functionName: "withdraw_from_staking_pool",
            functionArgs: { amount: amountYocto },
            gasLimit: { teraGas: "125" },
          }),
        },
        mutate: {
          onSuccess: (_data, _variables, _onMutateResult, context) => {
            invalidateLockupQueries(lockupAccountId, poolId, context);
          },
        },
      });
    },
    ...mutation,
  };
}

export function useWithdrawAllFromStakingPool(
  lockupAccountId: string,
  poolId: string
) {
  const mutation = useExecuteTransaction();

  return {
    withdrawAll: () => {
      mutation.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: functionCall({
            functionName: "withdraw_all_from_staking_pool",
            functionArgs: {},
            gasLimit: { teraGas: "175" },
          }),
        },
        mutate: {
          onSuccess: (_data, _variables, _onMutateResult, context) => {
            invalidateLockupQueries(lockupAccountId, poolId, context);
          },
        },
      });
    },
    ...mutation,
  };
}

/**
 * Transfer liquid tokens out of the lockup contract to `receiverId`.
 *
 * IMPORTANT: the contract's `transfer` uses `get_liquid_owners_balance()`,
 * which in turn depends on `get_known_deposited_balance()` — the cached
 * snapshot of the lockup's stake at the pool. If you need to access tokens
 * that are only reflected after staking rewards are synced, the user must
 * first run `refresh_staking_pool_balance` in a **separate earlier
 * transaction** and wait for its cross-contract callback to commit. The
 * transfer call cannot be batched in the same transaction as the refresh,
 * because actions in a single transaction run before cross-contract receipts
 * resolve and the staking pool status stays `Busy` for the rest of the batch.
 */
export function useTransferFromLockup(lockupAccountId: string) {
  const mutation = useExecuteTransaction();

  return {
    transfer: (args: { amountYocto: string; receiverId: string }) => {
      mutation.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: functionCall({
            functionName: "transfer",
            functionArgs: {
              amount: args.amountYocto,
              receiver_id: args.receiverId,
            },
            gasLimit: { teraGas: "50" },
          }),
        },
        mutate: {
          onSuccess: (_data, _variables, _onMutateResult, context) => {
            void context.client.invalidateQueries({
              queryKey: [
                "callContractReadFunction",
                lockupAccountId,
                "get_liquid_owners_balance",
              ],
            });
            void context.client.invalidateQueries({
              queryKey: ["getAccountInfo", lockupAccountId],
            });
          },
        },
      });
    },
    ...mutation,
  };
}

/**
 * Calls `check_transfers_vote` on the lockup contract. Transfers were enabled
 * globally on NEAR mainnet in Oct 2020; individual lockup contracts that still
 * show transfers as disabled just need to query the transfer poll voting
 * contract to update their cached `TransfersInformation` state. This is a
 * one-shot action the owner performs once per stale lockup.
 */
export function useCheckTransfersVote(lockupAccountId: string) {
  const mutation = useExecuteTransaction();

  return {
    checkTransfersVote: () => {
      mutation.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: functionCall({
            functionName: "check_transfers_vote",
            functionArgs: {},
            gasLimit: { teraGas: "75" },
          }),
        },
        mutate: {
          onSuccess: (_data, _variables, _onMutateResult, context) => {
            void context.client.invalidateQueries({
              queryKey: [
                "callContractReadFunction",
                lockupAccountId,
                "are_transfers_enabled",
              ],
            });
            void context.client.invalidateQueries({
              queryKey: [
                "callContractReadFunction",
                lockupAccountId,
                "get_locked_amount",
              ],
            });
          },
        },
      });
    },
    ...mutation,
  };
}

export function useRefreshStakingPoolBalance(
  lockupAccountId: string,
  poolId: string
) {
  const mutation = useExecuteTransaction();

  return {
    refresh: () => {
      mutation.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: functionCall({
            functionName: "refresh_staking_pool_balance",
            functionArgs: {},
            gasLimit: { teraGas: "75" },
          }),
        },
        mutate: {
          onSuccess: (_data, _variables, _onMutateResult, context) => {
            invalidateLockupQueries(lockupAccountId, poolId, context);
          },
        },
      });
    },
    ...mutation,
  };
}
