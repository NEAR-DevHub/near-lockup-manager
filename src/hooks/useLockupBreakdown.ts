"use client";

import { useAccountInfo } from "react-near-ts";
import {
  useLockupLockedAmount,
  useLockupStakingPool,
} from "@/hooks/useLockup";
import { useStakingPoolAccount } from "@/hooks/useLockupStaking";

export const MIN_BALANCE_FOR_STORAGE = BigInt("3500000000000000000000000"); // 3.5 NEAR

export type LockupBreakdown = {
  isLoading: boolean;
  isError: boolean;
  onChain: bigint | null;
  poolStaked: bigint;
  poolUnstaked: bigint;
  canWithdraw: boolean;
  lockedVesting: bigint | null;
  lockedStorage: bigint;
  afterUnstake: bigint;
  availableNow: bigint | null;
  total: bigint | null;
  poolId: string;
};

/**
 * Compute the 4-category balance breakdown for a lockup contract.
 *
 * Invariant: `total === lockedVesting + lockedStorage + availableNow + afterUnstake`
 *
 * Reasoning:
 *   total = onChain + poolStaked + poolUnstaked
 *
 *   `lockedVesting` (`get_locked_amount()`) and `lockedStorage` (3.5 NEAR) are
 *   *logical* slices: they describe tokens whose use is restricted, regardless
 *   of whether those tokens physically sit on-chain or at the staking pool.
 *   We take them off the top.
 *
 *   The remaining `spendableTotal = total - locked - storage` is then split
 *   by *physical access*:
 *     - `availableNow` = tokens the owner can cash out today without waiting.
 *       Limited by what's physically accessible without waiting:
 *       on-chain balance plus any pool-unstaked tokens that can already be
 *       withdrawn (`can_withdraw === true`). Minus the 3.5 NEAR storage
 *       reserve that's physically held on-chain.
 *     - `afterUnstake` = the rest — tokens that are staked or in the unstaking
 *       delay at the pool and need an unstake + ~48h wait + withdraw before
 *       they become transferable.
 *
 *   If the contract reports a locked amount larger than `total - storage`
 *   (shouldn't happen for a well-formed lockup, but we clamp to be safe),
 *   lockedVesting is reduced so the invariant still holds.
 */
export function useLockupBreakdown(
  lockupAccountId: string
): LockupBreakdown {
  const accountInfo = useAccountInfo({ accountId: lockupAccountId });
  const locked = useLockupLockedAmount(lockupAccountId);
  const stakingPool = useLockupStakingPool(lockupAccountId);

  const poolId = stakingPool.data?.result ?? "";
  const poolAccount = useStakingPoolAccount(poolId, lockupAccountId);

  const onChain = accountInfo.data
    ? BigInt(accountInfo.data.accountInfo.balance.total.yoctoNear)
    : null;
  const poolStaked = poolAccount.data
    ? BigInt(poolAccount.data.result.staked_balance)
    : BigInt(0);
  const poolUnstaked = poolAccount.data
    ? BigInt(poolAccount.data.result.unstaked_balance)
    : BigInt(0);
  const canWithdraw = poolAccount.data?.result.can_withdraw ?? false;
  const reportedLocked = locked.data ? BigInt(locked.data.result) : null;

  const total =
    onChain !== null ? onChain + poolStaked + poolUnstaked : null;

  let lockedVesting: bigint | null = null;
  let afterUnstake = BigInt(0);
  let availableNow: bigint | null = null;

  if (total !== null && reportedLocked !== null) {
    // Clamp locked so `locked + storage <= total` (safety; should always hold).
    const maxLockable =
      total > MIN_BALANCE_FOR_STORAGE ? total - MIN_BALANCE_FOR_STORAGE : BigInt(0);
    lockedVesting = bigMin(reportedLocked, maxLockable);

    const spendableTotal =
      total > lockedVesting + MIN_BALANCE_FOR_STORAGE
        ? total - lockedVesting - MIN_BALANCE_FOR_STORAGE
        : BigInt(0);

    // Tokens physically accessible without waiting: on-chain + withdrawable
    // unstaked at the pool (can be pulled via `withdraw_from_staking_pool`
    // without any epoch wait).
    const withdrawablePoolUnstaked = canWithdraw ? poolUnstaked : BigInt(0);
    const accessibleNow = onChain! + withdrawablePoolUnstaked;

    // Of what's accessible now, the 3.5 NEAR storage reserve is physically
    // held on-chain and never transferable, so subtract it.
    const accessibleAfterStorage =
      accessibleNow > MIN_BALANCE_FOR_STORAGE
        ? accessibleNow - MIN_BALANCE_FOR_STORAGE
        : BigInt(0);

    availableNow = bigMin(spendableTotal, accessibleAfterStorage);
    afterUnstake = spendableTotal - availableNow;
  }

  const isLoading =
    accountInfo.isLoading ||
    locked.isLoading ||
    stakingPool.isLoading ||
    (poolId.length > 0 && poolAccount.isLoading);

  const isError = accountInfo.isError || locked.isError;

  return {
    isLoading,
    isError,
    onChain,
    poolStaked,
    poolUnstaked,
    canWithdraw,
    lockedVesting,
    lockedStorage: MIN_BALANCE_FOR_STORAGE,
    afterUnstake,
    availableNow,
    total,
    poolId,
  };
}

function bigMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
