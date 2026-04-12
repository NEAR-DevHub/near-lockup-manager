"use client";

import {
  useTransfersEnabled,
  useVestingInformation,
} from "@/hooks/useLockup";
import { useLockupBreakdown } from "@/hooks/useLockupBreakdown";
import { useCheckTransfersVote } from "@/hooks/useLockupStaking";
import { formatNearAmount } from "@/lib/near";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Info, Loader2 } from "lucide-react";

function BalanceRow({
  label,
  value,
  isLoading,
  note,
  bold,
  stale,
}: {
  label: string;
  value?: string;
  isLoading: boolean;
  note?: string;
  bold?: boolean;
  stale?: boolean;
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
          className={[
            bold
              ? "font-mono text-sm tabular-nums font-semibold"
              : "font-mono text-sm tabular-nums font-medium",
            stale ? "text-amber-700 dark:text-amber-300" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {value ? formatNearAmount(value) : "—"} NEAR
          {stale && (
            <span className="ml-1 text-xs font-normal text-amber-700 dark:text-amber-300">
              (stale)
            </span>
          )}
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
  const checkTransfers = useCheckTransfersVote(lockupAccountId);

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

  // When `TransfersInformation` is still stale-cached as `TransfersDisabled`,
  // the contract's `get_locked_amount()` returns the full original lockup
  // amount — the release/vesting clock doesn't start until `transfers_timestamp`
  // is recorded, which only happens after `check_transfers_vote` is called.
  // Since transfers were enabled globally in Oct 2020, any lockup in this state
  // for long enough has effectively been released already, and the displayed
  // "Locked (not yet vested)" is a misleading stale value.
  const transfersStale = transfers.data?.result === false;
  const lockedStale = transfersStale && !!b.lockedVesting && b.lockedVesting > BigInt(0);

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
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20"
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
      <CardContent className="space-y-3">
        {transfersStale && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="space-y-2">
              <p>
                This lockup&apos;s cached{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  TransfersInformation
                </code>{" "}
                is still <strong>TransfersDisabled</strong>, even though
                transfers were enabled globally on NEAR in October 2020. Until
                this is synced, the contract reports the full original lockup
                amount as &ldquo;locked&rdquo; because the release/vesting clock
                only starts ticking from{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  transfers_timestamp
                </code>
                .
                {lockedStale && (
                  <>
                    {" "}
                    The <strong>Locked (not yet vested)</strong> figure below
                    is almost certainly stale — after calling{" "}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      check_transfers_vote
                    </code>
                    , the contract will apply the release schedule and most (or
                    all) of the locked amount should unlock.
                  </>
                )}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => checkTransfers.checkTransfersVote()}
                disabled={checkTransfers.isPending}
              >
                {checkTransfers.isPending && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                {checkTransfers.isPending
                  ? "Syncing..."
                  : "Call check_transfers_vote"}
              </Button>
              {checkTransfers.isError && checkTransfers.error && (
                <p className="text-xs text-destructive">
                  {checkTransfers.error.message}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-0 divide-y">
          <BalanceRow
            label="Locked (not yet vested)"
            value={b.lockedVesting?.toString()}
            isLoading={b.isLoading}
            stale={lockedStale}
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
        </div>
      </CardContent>
    </Card>
  );
}
