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
  const lockedVesting = locked.data ? BigInt(locked.data.result) : null;

  const total =
    onChain !== null ? onChain + poolStaked + poolUnstaked : null;
  const poolUnstakedPending = canWithdraw ? BigInt(0) : poolUnstaked;
  const afterUnstake = poolStaked + poolUnstakedPending;
  const availableNow =
    total !== null && lockedVesting !== null
      ? bigMax(
          total - lockedVesting - MIN_BALANCE_FOR_STORAGE - afterUnstake,
          BigInt(0)
        )
      : null;

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

function bigMax(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}
