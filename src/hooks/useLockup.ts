"use client";

import {
  type DeserializeResultFnArgs,
  fromJsonBytes,
  useContractReadFunction,
} from "react-near-ts";
import * as z from "zod/mini";

const deserializeU128 = (args: DeserializeResultFnArgs): string => {
  const raw = fromJsonBytes(args.rawResult);
  return typeof raw === "string" ? raw : String(raw);
};

const deserializeBool = (args: DeserializeResultFnArgs): boolean =>
  Boolean(fromJsonBytes(args.rawResult));

const deserializeString = (args: DeserializeResultFnArgs): string =>
  String(fromJsonBytes(args.rawResult));

const deserializeOptionalString = (
  args: DeserializeResultFnArgs
): string | null => {
  const raw = fromJsonBytes(args.rawResult);
  return raw === null || raw === undefined ? null : String(raw);
};

const VestingInfoSchema = z.union([
  z.literal("None"),
  z.object({ VestingHash: z.string() }),
  z.object({
    VestingSchedule: z.object({
      start_timestamp: z.string(),
      cliff_timestamp: z.string(),
      end_timestamp: z.string(),
    }),
  }),
  z.object({
    Terminating: z.object({
      unvested_amount: z.string(),
      status: z.string(),
    }),
  }),
]);

type VestingInfo = z.infer<typeof VestingInfoSchema>;

const deserializeVestingInfo = (args: DeserializeResultFnArgs): VestingInfo =>
  VestingInfoSchema.parse(fromJsonBytes(args.rawResult));

export function useLockupOwner(lockupAccountId: string) {
  return useContractReadFunction({
    contractAccountId: lockupAccountId,
    functionName: "get_owner_account_id",
    functionArgs: {},
    options: { deserializeResult: deserializeString },
    query: { enabled: lockupAccountId.length > 0 },
  });
}

export function useLockupBalance(lockupAccountId: string) {
  return useContractReadFunction({
    contractAccountId: lockupAccountId,
    functionName: "get_balance",
    functionArgs: {},
    options: { deserializeResult: deserializeU128 },
    query: { enabled: lockupAccountId.length > 0 },
  });
}

export function useLockupLockedAmount(lockupAccountId: string) {
  return useContractReadFunction({
    contractAccountId: lockupAccountId,
    functionName: "get_locked_amount",
    functionArgs: {},
    options: { deserializeResult: deserializeU128 },
    query: { enabled: lockupAccountId.length > 0 },
  });
}

export function useLockupOwnersBalance(lockupAccountId: string) {
  return useContractReadFunction({
    contractAccountId: lockupAccountId,
    functionName: "get_owners_balance",
    functionArgs: {},
    options: { deserializeResult: deserializeU128 },
    query: { enabled: lockupAccountId.length > 0 },
  });
}

export function useLockupLiquidBalance(lockupAccountId: string) {
  return useContractReadFunction({
    contractAccountId: lockupAccountId,
    functionName: "get_liquid_owners_balance",
    functionArgs: {},
    options: { deserializeResult: deserializeU128 },
    query: { enabled: lockupAccountId.length > 0 },
  });
}

/**
 * The "cached" liquid owners balance. The contract's get_liquid_owners_balance
 * depends on get_known_deposited_balance, which is a cached snapshot of the
 * lockup's stake at the staking pool (not including accrued rewards).
 * Calling refresh_staking_pool_balance updates that cache.
 */
export const useCachedLiquidBalance = useLockupLiquidBalance;

export function useLockupStakingPool(lockupAccountId: string) {
  return useContractReadFunction({
    contractAccountId: lockupAccountId,
    functionName: "get_staking_pool_account_id",
    functionArgs: {},
    options: { deserializeResult: deserializeOptionalString },
    query: { enabled: lockupAccountId.length > 0 },
  });
}

export function useLockupKnownDeposited(lockupAccountId: string) {
  return useContractReadFunction({
    contractAccountId: lockupAccountId,
    functionName: "get_known_deposited_balance",
    functionArgs: {},
    options: { deserializeResult: deserializeU128 },
    query: { enabled: lockupAccountId.length > 0 },
  });
}

export function useTransfersEnabled(lockupAccountId: string) {
  return useContractReadFunction({
    contractAccountId: lockupAccountId,
    functionName: "are_transfers_enabled",
    functionArgs: {},
    options: { deserializeResult: deserializeBool },
    query: { enabled: lockupAccountId.length > 0 },
  });
}

export function useVestingInformation(lockupAccountId: string) {
  return useContractReadFunction({
    contractAccountId: lockupAccountId,
    functionName: "get_vesting_information",
    functionArgs: {},
    options: { deserializeResult: deserializeVestingInfo },
    query: { enabled: lockupAccountId.length > 0 },
  });
}
