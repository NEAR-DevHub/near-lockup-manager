"use client";

import { useState } from "react";
import {
  useCachedLiquidBalance,
  useTransfersEnabled,
} from "@/hooks/useLockup";
import {
  useTransferFromLockup,
  useCheckTransfersVote,
  useRefreshStakingPoolBalance,
} from "@/hooks/useLockupStaking";
import { useLockupBreakdown } from "@/hooks/useLockupBreakdown";
import { formatNearAmount, parseNearToYocto } from "@/lib/near";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";

export function TransferForm({
  lockupAccountId,
  ownerAccountId,
}: {
  lockupAccountId: string;
  ownerAccountId: string;
}) {
  const [amount, setAmount] = useState("");
  const [receiver, setReceiver] = useState(ownerAccountId);

  const b = useLockupBreakdown(lockupAccountId);
  const poolId = b.poolId.length > 0 ? b.poolId : null;
  const availableNowYocto = b.availableNow?.toString() ?? "0";

  const cachedLiquid = useCachedLiquidBalance(lockupAccountId);
  const cachedLiquidYocto = cachedLiquid.data?.result ?? "0";

  const transfersEnabled = useTransfersEnabled(lockupAccountId);
  const transfersOk = transfersEnabled.data?.result === true;
  const checkTransfers = useCheckTransfersVote(lockupAccountId);

  const refreshPool = useRefreshStakingPoolBalance(
    lockupAccountId,
    poolId ?? ""
  );

  const { transfer, isPending, isError, error, isSuccess } =
    useTransferFromLockup(lockupAccountId);

  const cleanAmount = amount.replace(/,/g, "").trim();
  const amountYocto = cleanAmount ? parseNearToYocto(cleanAmount) : "0";

  const needsRefresh =
    cleanAmount !== "" &&
    poolId !== null &&
    BigInt(amountYocto) > BigInt(cachedLiquidYocto);

  const exceedsAvailable =
    cleanAmount !== "" && BigInt(amountYocto) > BigInt(availableNowYocto);

  const isLoading = b.isLoading || cachedLiquid.isLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !cleanAmount ||
      !receiver.trim() ||
      exceedsAvailable ||
      needsRefresh ||
      !transfersOk
    )
      return;
    transfer({
      amountYocto,
      receiverId: receiver.trim(),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Withdraw</CardTitle>
        <CardDescription>
          Transfer liquid tokens out of the lockup contract.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="transfer-amount">Amount (NEAR)</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() =>
                  setAmount(
                    formatNearAmount(availableNowYocto).replace(/,/g, "")
                  )
                }
                disabled={isLoading}
              >
                Max: {formatNearAmount(availableNowYocto)}
              </button>
            </div>
            <Input
              id="transfer-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-receiver">Receiver account</Label>
            <Input
              id="transfer-receiver"
              type="text"
              placeholder="account.near"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to the lockup owner account.
            </p>
          </div>

          {!transfersEnabled.isLoading && !transfersOk && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>
                  Transfers are enabled globally on NEAR, but this lockup
                  contract still has the old cached state. Call{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    check_transfers_vote
                  </code>{" "}
                  to sync it with the transfer poll, then you can transfer.
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

          {needsRefresh && !exceedsAvailable && transfersOk && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>
                  Amount exceeds the contract&apos;s cached liquid balance (
                  {formatNearAmount(cachedLiquidYocto)} NEAR). The lockup
                  contract&apos;s <code className="text-xs bg-muted px-1 py-0.5 rounded">transfer</code>{" "}
                  assertion reads this cached value, so you need to refresh it
                  first by calling{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">
                    refresh_staking_pool_balance
                  </code>
                  . This is a separate transaction &mdash; its result
                  (querying the staking pool) must be committed on-chain before
                  the transfer can succeed.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => refreshPool.refresh()}
                  disabled={refreshPool.isPending}
                >
                  {refreshPool.isPending && (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  )}
                  {refreshPool.isPending
                    ? "Refreshing..."
                    : "Call refresh_staking_pool_balance"}
                </Button>
                {refreshPool.isError && refreshPool.error && (
                  <p className="text-xs text-destructive">
                    {refreshPool.error.message}
                  </p>
                )}
                {refreshPool.isSuccess && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-300">
                    Refreshed. Cached liquid balance is being reloaded...
                  </p>
                )}
              </AlertDescription>
            </Alert>
          )}

          {exceedsAvailable && (
            <Alert variant="destructive">
              <AlertDescription>
                Amount exceeds what&apos;s available for withdrawal now (
                {formatNearAmount(availableNowYocto)} NEAR). Unstake and wait
                for the withdrawal epoch before transferring more.
              </AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              !cleanAmount ||
              !receiver.trim() ||
              isPending ||
              exceedsAvailable ||
              isLoading ||
              !transfersOk ||
              needsRefresh
            }
          >
            {isPending
              ? "Transferring..."
              : needsRefresh
                ? "Refresh required before transfer"
                : "Transfer"}
          </Button>

          {isSuccess && (
            <Alert>
              <AlertDescription>
                Transferred {formatNearAmount(amountYocto)} NEAR to{" "}
                <span className="font-mono text-xs">{receiver}</span>.
              </AlertDescription>
            </Alert>
          )}
          {isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {error?.message || "Transfer failed"}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
