"use client";

import { useState } from "react";
import { useLockupStakingPool } from "@/hooks/useLockup";
import { useAccountInfo } from "react-near-ts";
import {
  useStakingPoolAccount,
  useSelectStakingPool,
  useUnselectStakingPool,
  useDepositAndStake,
  useUnstake,
  useUnstakeAll,
  useWithdrawAllFromStakingPool,
  useRefreshStakingPoolBalance,
} from "@/hooks/useLockupStaking";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";

function SelectPoolForm({
  lockupAccountId,
  isOwner,
}: {
  lockupAccountId: string;
  isOwner: boolean;
}) {
  const [poolInput, setPoolInput] = useState("");
  const { selectPool, isPending, isError, error } =
    useSelectStakingPool(lockupAccountId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Staking Delegation</CardTitle>
        <CardDescription>
          No staking pool selected. Select a whitelisted staking pool to begin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isOwner ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const id = poolInput.trim();
              if (id) selectPool(id);
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="pool-id">Staking pool account ID</Label>
              <Input
                id="pool-id"
                type="text"
                placeholder="pool.poolv1.near"
                value={poolInput}
                onChange={(e) => setPoolInput(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={!poolInput.trim() || isPending}>
              {isPending ? "Selecting..." : "Select Pool"}
            </Button>
            {isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error?.message || "Failed to select pool"}
                </AlertDescription>
              </Alert>
            )}
          </form>
        ) : (
          <div className="rounded-lg border border-dashed bg-card py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Connect as the lockup owner to manage staking
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StakingManagement({
  lockupAccountId,
  isOwner,
}: {
  lockupAccountId: string;
  isOwner: boolean;
}) {
  const stakingPool = useLockupStakingPool(lockupAccountId);
  const poolId = stakingPool.data?.result ?? "";

  if (stakingPool.isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (!poolId) {
    return (
      <SelectPoolForm
        lockupAccountId={lockupAccountId}
        isOwner={isOwner}
      />
    );
  }

  return (
    <StakingDashboard
      lockupAccountId={lockupAccountId}
      poolId={poolId}
      isOwner={isOwner}
    />
  );
}

function StakingDashboard({
  lockupAccountId,
  poolId,
  isOwner,
}: {
  lockupAccountId: string;
  poolId: string;
  isOwner: boolean;
}) {
  const poolAccount = useStakingPoolAccount(poolId, lockupAccountId);
  const accountInfo = useAccountInfo({ accountId: lockupAccountId });

  // Max stakeable = on-chain balance minus 3.5 NEAR storage reserve
  const MIN_STORAGE = BigInt("3500000000000000000000000");
  const onChainBalance = accountInfo.data
    ? accountInfo.data.accountInfo.balance.total.yoctoNear.toString()
    : "0";
  const maxStakeable =
    BigInt(onChainBalance) > MIN_STORAGE
      ? (BigInt(onChainBalance) - MIN_STORAGE).toString()
      : "0";

  const { unselectPool, isPending: unselectPending } =
    useUnselectStakingPool(lockupAccountId);
  const { refresh, isPending: refreshPending } =
    useRefreshStakingPoolBalance(lockupAccountId, poolId);

  const staked = poolAccount.data?.result.staked_balance ?? "0";
  const unstaked = poolAccount.data?.result.unstaked_balance ?? "0";
  const canWithdraw = poolAccount.data?.result.can_withdraw ?? false;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Staking Delegation</CardTitle>
          {isOwner && (
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refresh()}
                disabled={refreshPending}
                title="Refresh staking pool balance"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshPending ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          )}
        </div>
        <CardDescription className="font-mono text-xs">
          Pool: {poolId}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">Staked</p>
            {poolAccount.isLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <p className="font-mono text-sm tabular-nums font-medium">
                {formatNearAmount(staked)} NEAR
              </p>
            )}
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground mb-1">Unstaked</p>
            {poolAccount.isLoading ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="font-mono text-sm tabular-nums font-medium">
                  {formatNearAmount(unstaked)} NEAR
                </p>
                {BigInt(unstaked) > BigInt(0) && (
                  <Badge
                    className={
                      canWithdraw
                        ? "bg-blue-500/15 text-blue-700 border-blue-500/20 text-[10px] px-1.5 py-0"
                        : "bg-amber-500/15 text-amber-700 border-amber-500/20 text-[10px] px-1.5 py-0"
                    }
                  >
                    {canWithdraw ? "Withdraw ready" : "Pending"}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {isOwner && (
          <>
            <Tabs defaultValue="stake" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="stake" className="flex-1">
                  Stake
                </TabsTrigger>
                <TabsTrigger value="unstake" className="flex-1">
                  Unstake
                </TabsTrigger>
                <TabsTrigger value="withdraw" className="flex-1">
                  Withdraw
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stake">
                <StakeForm
                  lockupAccountId={lockupAccountId}
                  poolId={poolId}
                  maxYocto={maxStakeable}
                />
              </TabsContent>

              <TabsContent value="unstake">
                <UnstakeForm
                  lockupAccountId={lockupAccountId}
                  poolId={poolId}
                  stakedYocto={staked}
                />
              </TabsContent>

              <TabsContent value="withdraw">
                <WithdrawSection
                  lockupAccountId={lockupAccountId}
                  poolId={poolId}
                  unstakedYocto={unstaked}
                  canWithdraw={canWithdraw}
                />
              </TabsContent>
            </Tabs>

            {BigInt(staked) === BigInt(0) &&
              BigInt(unstaked) === BigInt(0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unselectPool()}
                  disabled={unselectPending}
                  className="w-full"
                >
                  {unselectPending
                    ? "Unselecting..."
                    : "Unselect Staking Pool"}
                </Button>
              )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StakeForm({
  lockupAccountId,
  poolId,
  maxYocto,
}: {
  lockupAccountId: string;
  poolId: string;
  maxYocto: string;
}) {
  const [amount, setAmount] = useState("");
  const { depositAndStake, isPending, isError, error, isSuccess } =
    useDepositAndStake(lockupAccountId, poolId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = amount.replace(/,/g, "").trim();
    if (!clean) return;
    depositAndStake(parseNearToYocto(clean));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="stake-amount">Amount (NEAR)</Label>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() =>
              setAmount(formatNearAmount(maxYocto).replace(/,/g, ""))
            }
          >
            Max: {formatNearAmount(maxYocto)}
          </button>
        </div>
        <Input
          id="stake-amount"
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={!amount || isPending}>
        {isPending ? "Staking..." : "Deposit & Stake"}
      </Button>
      {isSuccess && (
        <Alert>
          <AlertDescription>Staked successfully.</AlertDescription>
        </Alert>
      )}
      {isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || "Failed to stake"}
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}

function UnstakeForm({
  lockupAccountId,
  poolId,
  stakedYocto,
}: {
  lockupAccountId: string;
  poolId: string;
  stakedYocto: string;
}) {
  const [amount, setAmount] = useState("");
  const { unstake, isPending, isError, error, isSuccess } = useUnstake(
    lockupAccountId,
    poolId
  );
  const {
    unstakeAll,
    isPending: unstakeAllPending,
    isError: unstakeAllError,
    isSuccess: unstakeAllSuccess,
  } = useUnstakeAll(lockupAccountId, poolId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = amount.replace(/,/g, "").trim();
    if (!clean) return;
    unstake(parseNearToYocto(clean));
  };

  return (
    <div className="space-y-3 pt-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="unstake-amount">Amount (NEAR)</Label>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() =>
                setAmount(formatNearAmount(stakedYocto).replace(/,/g, ""))
              }
            >
              Staked: {formatNearAmount(stakedYocto)}
            </button>
          </div>
          <Input
            id="unstake-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            className="flex-1"
            disabled={!amount || isPending}
          >
            {isPending ? "Unstaking..." : "Unstake"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => unstakeAll()}
            disabled={
              unstakeAllPending || BigInt(stakedYocto) === BigInt(0)
            }
          >
            {unstakeAllPending ? "..." : "Unstake All"}
          </Button>
        </div>
      </form>
      {(isSuccess || unstakeAllSuccess) && (
        <Alert>
          <AlertDescription>
            Unstaked successfully. Tokens will be available for withdrawal after
            ~48 hours (4 epochs).
          </AlertDescription>
        </Alert>
      )}
      {(isError || unstakeAllError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || "Failed to unstake"}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function WithdrawSection({
  lockupAccountId,
  poolId,
  unstakedYocto,
  canWithdraw,
}: {
  lockupAccountId: string;
  poolId: string;
  unstakedYocto: string;
  canWithdraw: boolean;
}) {
  const { withdrawAll, isPending, isError, error, isSuccess } =
    useWithdrawAllFromStakingPool(lockupAccountId, poolId);

  const hasUnstaked = BigInt(unstakedYocto) > BigInt(1000);

  return (
    <div className="space-y-3 pt-3">
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground mb-1">
          Available to withdraw
        </p>
        <p className="font-mono text-sm tabular-nums font-medium">
          {canWithdraw ? formatNearAmount(unstakedYocto) : "0"} NEAR
        </p>
        {hasUnstaked && !canWithdraw && (
          <p className="text-xs text-amber-600 mt-1">
            {formatNearAmount(unstakedYocto)} NEAR unstaked but not yet
            available (~48h wait)
          </p>
        )}
      </div>
      <Button
        className="w-full"
        onClick={() => withdrawAll()}
        disabled={!canWithdraw || !hasUnstaked || isPending}
      >
        {isPending ? "Withdrawing..." : "Withdraw All"}
      </Button>
      {isSuccess && (
        <Alert>
          <AlertDescription>
            Withdrawn successfully. Funds returned to lockup contract.
          </AlertDescription>
        </Alert>
      )}
      {isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || "Failed to withdraw"}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
