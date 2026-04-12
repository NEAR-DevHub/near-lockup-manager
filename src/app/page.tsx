"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNearSignIn, useConnectedAccount } from "react-near-ts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NearIcon } from "@/components/NearIcon";

export default function Home() {
  const router = useRouter();
  const { signIn } = useNearSignIn();
  const account = useConnectedAccount();
  const [lookupId, setLookupId] = useState("");

  useEffect(() => {
    if (account.isConnectedAccount) {
      router.replace(`/${account.connectedAccountId}`);
    }
  }, [account.isConnectedAccount, account, router]);

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center">
            <NearIcon className="mx-auto mb-4 h-10 w-10" />
            <h1 className="text-2xl font-bold tracking-tight">
              NEAR Lockup Manager
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your NEAR lockup contract &mdash; staking delegation and
              lockup removal
            </p>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base">Connect Wallet</CardTitle>
              <CardDescription>
                Sign in as the lockup owner account to manage your lockup
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => signIn()}>
                Connect Wallet
              </Button>
            </CardContent>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-muted/40 px-2 text-muted-foreground">
                Or look up any owner
              </span>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const id = lookupId.trim();
              if (id) router.push(`/${id}`);
            }}
          >
            <div className="flex gap-2">
              <Input
                className="flex-1"
                placeholder="owner-account.near"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={!lookupId.trim()}
              >
                View
              </Button>
            </div>
          </form>
        </div>
      </main>

      <Footer />
    </div>
  );
}
