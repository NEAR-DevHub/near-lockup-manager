"use client";

import Link from "next/link";
import {
  useNearSignIn,
  useNearSignOut,
  useConnectedAccount,
} from "react-near-ts";
import { Button } from "@/components/ui/button";
import { NearIcon } from "@/components/NearIcon";

function truncateAccountId(id: string, maxLen = 24) {
  if (id.length <= maxLen) return id;
  return id.slice(0, 12) + "..." + id.slice(-8);
}

export function Header() {
  const { signIn } = useNearSignIn();
  const { signOut } = useNearSignOut();
  const account = useConnectedAccount();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-1.5">
            <NearIcon className="h-5 w-5" />
            <span className="text-base font-semibold tracking-tight hidden sm:inline">
              Lockup Manager
            </span>
          </Link>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            by{" "}
            <a
              href="https://trezu.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Trezu
            </a>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {account.isConnectedAccount ? (
            <>
              <Link
                href={`/${account.connectedAccountId}`}
                className="rounded-md px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {truncateAccountId(account.connectedAccountId)}
              </Link>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => signIn()}>
              Connect Wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
