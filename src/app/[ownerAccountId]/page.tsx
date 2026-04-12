"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useConnectedAccount } from "react-near-ts";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LockupInfo } from "@/components/LockupInfo";
import { TransferForm } from "@/components/TransferForm";
import { StakingManagement } from "@/components/StakingManagement";
import { RemoveLockup } from "@/components/RemoveLockup";
import { Skeleton } from "@/components/ui/skeleton";
import { deriveLockupAccountId } from "@/lib/near";

export default function OwnerDashboard() {
  const { ownerAccountId } = useParams<{ ownerAccountId: string }>();
  const account = useConnectedAccount();
  const [lockupAccountId, setLockupAccountId] = useState<string | null>(null);

  const isOwner =
    account.isConnectedAccount &&
    account.connectedAccountId === ownerAccountId;

  useEffect(() => {
    if (ownerAccountId) {
      deriveLockupAccountId(ownerAccountId).then(setLockupAccountId);
    }
  }, [ownerAccountId]);

  if (!lockupAccountId) {
    return (
      <div className="flex min-h-screen flex-col bg-muted/40">
        <Header />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-48 w-full" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <Header />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Lockup Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Owner:{" "}
            <span className="font-mono">{ownerAccountId}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Lockup:{" "}
            <span className="font-mono text-xs">{lockupAccountId}</span>
          </p>
        </div>

        <LockupInfo lockupAccountId={lockupAccountId} />

        {isOwner && (
          <TransferForm
            lockupAccountId={lockupAccountId}
            ownerAccountId={ownerAccountId}
          />
        )}

        <StakingManagement
          lockupAccountId={lockupAccountId}
          isOwner={isOwner}
        />

        {isOwner && (
          <RemoveLockup
            lockupAccountId={lockupAccountId}
            ownerAccountId={ownerAccountId}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
