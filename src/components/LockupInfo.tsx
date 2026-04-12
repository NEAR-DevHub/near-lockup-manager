"use client";

import {
  useTransfersEnabled,
  useVestingInformation,
} from "@/hooks/useLockup";
import { useLockupBreakdown } from "@/hooks/useLockupBreakdown";
import { formatNearAmount } from "@/lib/near";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

function BalanceRow({
  label,
  value,
  isLoading,
  note,
  bold,
}: {
  label: string;
  value?: string;
  isLoading: boolean;
  note?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex flex-col">
        <span
          className={
            bold ? "text-sm font-medium" : "text-sm text-muted-foreground"
          }
        >
          {label}
        </span>
        {note && (
          <span className="text-xs text-muted-foreground/70">{note}</span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-4 w-24" />
      ) : (
        <span
          className={
            bold
              ? "font-mono text-sm tabular-nums font-semibold"
              : "font-mono text-sm tabular-nums font-medium"
          }
        >
          {value ? formatNearAmount(value) : "—"} NEAR
        </span>
      )}
    </div>
  );
}

function vestingLabel(info: unknown): string {
  if (info === "None") return "No vesting";
  if (typeof info === "object" && info !== null) {
    if ("VestingHash" in info) return "Private vesting (hashed)";
    if ("VestingSchedule" in info) return "Vesting schedule active";
    if ("Terminating" in info) return "Vesting terminated";
  }
  return "Unknown";
}

export function LockupInfo({
  lockupAccountId,
}: {
  lockupAccountId: string;
}) {
  const b = useLockupBreakdown(lockupAccountId);
  const transfers = useTransfersEnabled(lockupAccountId);
  const vesting = useVestingInformation(lockupAccountId);

  if (b.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load lockup contract. The lockup account may not exist for
          this owner.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Lockup Overview</CardTitle>
          <div className="flex gap-1.5">
            {transfers.data && (
              <Badge
                className={
                  transfers.data.result
                    ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/20"
                    : "bg-amber-500/15 text-amber-700 border-amber-500/20"
                }
              >
                Transfers {transfers.data.result ? "enabled" : "disabled"}
              </Badge>
            )}
            {vesting.data && (
              <Badge variant="secondary">
                {vestingLabel(vesting.data.result)}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-0 divide-y">
        <BalanceRow
          label="Locked (not yet vested)"
          value={b.lockedVesting?.toString()}
          isLoading={b.isLoading}
        />
        <BalanceRow
          label="Locked for smart contract"
          note="Reclaimable only with full removal of lockup"
          value={b.lockedStorage.toString()}
          isLoading={false}
        />
        <BalanceRow
          label="Available for withdrawal now"
          value={b.availableNow?.toString()}
          isLoading={b.isLoading}
        />
        {!b.isLoading && b.afterUnstake > BigInt(0) && (
          <BalanceRow
            label="Available for withdrawal after unstake"
            value={b.afterUnstake.toString()}
            isLoading={false}
          />
        )}
        <BalanceRow
          label="Total balance"
          value={b.total?.toString()}
          isLoading={b.isLoading}
          bold
        />
      </CardContent>
    </Card>
  );
}
