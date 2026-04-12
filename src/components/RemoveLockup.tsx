"use client";

import { useState, useCallback, useRef } from "react";
import {
  useSignMessage,
  useExecuteTransaction,
  functionCall,
  createMessage,
  randomEd25519KeyPair,
  createMemoryKeyService,
  createMemorySigner,
  createMainnetClient,
  deleteAccount,
  type PublicKey,
  type PrivateKey,
} from "react-near-ts";
import {
  useTransfersEnabled,
  useLockupLockedAmount,
} from "@/hooks/useLockup";
import { useLockupBreakdown } from "@/hooks/useLockupBreakdown";
import { useCheckTransfersVote } from "@/hooks/useLockupStaking";
import { useContractReadFunction, fromJsonBytes } from "react-near-ts";
import * as z from "zod/mini";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  Check,
  Loader2,
  Trash2,
  X,
  CircleAlert,
} from "lucide-react";
import { formatNearAmount } from "@/lib/near";

type Step =
  | "idle"
  | "confirm"
  | "sign-message"
  | "add-keys"
  | "delete"
  | "done"
  | "error";

type Prereq = {
  key: string;
  label: string;
  status: "ok" | "blocked" | "loading";
  hint?: string;
  action?: {
    label: string;
    onClick: () => void;
    pending: boolean;
    error?: string;
  };
};

function useRemovalPrerequisites(lockupAccountId: string): {
  prereqs: Prereq[];
  allOk: boolean;
  isLoading: boolean;
} {
  const transfers = useTransfersEnabled(lockupAccountId);
  const locked = useLockupLockedAmount(lockupAccountId);
  const b = useLockupBreakdown(lockupAccountId);

  const checkTransfers = useCheckTransfersVote(lockupAccountId);

  // Termination status: null if no termination in progress, else a string
  const termination = useContractReadFunction({
    contractAccountId: lockupAccountId,
    functionName: "get_termination_status",
    functionArgs: {},
    options: {
      deserializeResult: (args) => {
        const raw = fromJsonBytes(args.rawResult);
        return raw === null || raw === undefined
          ? null
          : z.string().parse(raw);
      },
    },
    query: { enabled: lockupAccountId.length > 0 },
  });

  const isLoading =
    transfers.isLoading ||
    locked.isLoading ||
    b.isLoading ||
    termination.isLoading;

  const transfersOk = transfers.data?.result === true;
  const noTermination =
    termination.data?.result === null || termination.data?.result === undefined;
  const lockedAmountZero =
    locked.data !== undefined && BigInt(locked.data.result) === BigInt(0);
  const stakedZero = b.poolStaked === BigInt(0);
  const unstakedZero = b.poolUnstaked === BigInt(0);

  const status = (cond: boolean): "ok" | "blocked" | "loading" =>
    isLoading ? "loading" : cond ? "ok" : "blocked";

  const prereqs: Prereq[] = [
    {
      key: "transfers",
      label: "Transfers are enabled",
      status: status(!!transfersOk),
      hint: transfersOk
        ? undefined
        : "Transfers are already enabled globally on NEAR, but this lockup contract still has the old cached state. Call check_transfers_vote to sync it with the transfer poll contract — then this prerequisite will turn green.",
      action: transfersOk
        ? undefined
        : {
            label: checkTransfers.isPending
              ? "Syncing..."
              : "Call check_transfers_vote",
            onClick: () => checkTransfers.checkTransfersVote(),
            pending: checkTransfers.isPending,
            error:
              checkTransfers.isError && checkTransfers.error
                ? checkTransfers.error.message
                : undefined,
          },
    },
    {
      key: "locked",
      label: "No locked/unvested tokens remaining",
      status: status(lockedAmountZero),
      hint: lockedAmountZero
        ? undefined
        : locked.data
          ? `${formatNearAmount(locked.data.result)} NEAR is still locked or unvested. Wait for the vesting/lockup schedule to complete.`
          : undefined,
    },
    {
      key: "termination",
      label: "No vesting termination in progress",
      status: status(!!noTermination),
      hint: noTermination
        ? undefined
        : "A vesting termination is in progress. Only the NEAR Foundation can resolve it.",
    },
    {
      key: "staked",
      label: "All tokens unstaked from the staking pool",
      status: status(stakedZero),
      hint: stakedZero
        ? undefined
        : `${formatNearAmount(b.poolStaked.toString())} NEAR is still staked. Use the Staking Delegation → Unstake tab to unstake all. Staked tokens become inaccessible if the lockup account is deleted while they are still in the pool.`,
    },
    {
      key: "unstaked",
      label: "All unstaked tokens withdrawn from the pool",
      status: status(unstakedZero),
      hint: unstakedZero
        ? undefined
        : `${formatNearAmount(b.poolUnstaked.toString())} NEAR is unstaked but still at the pool. Wait the ~48h unstaking delay, then use Staking Delegation → Withdraw to pull them back to the lockup contract. Otherwise these tokens are lost on account deletion.`,
    },
  ];

  const allOk = prereqs.every((p) => p.status === "ok");
  return { prereqs, allOk, isLoading };
}

function PrereqRow({ prereq }: { prereq: Prereq }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="mt-0.5">
        {prereq.status === "loading" && (
          <Skeleton className="h-4 w-4 rounded-full" />
        )}
        {prereq.status === "ok" && (
          <div className="h-4 w-4 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <Check className="h-3 w-3" />
          </div>
        )}
        {prereq.status === "blocked" && (
          <div className="h-4 w-4 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
            <X className="h-3 w-3" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{prereq.label}</p>
        {prereq.hint && prereq.status === "blocked" && (
          <p className="text-xs text-muted-foreground mt-0.5">{prereq.hint}</p>
        )}
        {prereq.action && prereq.status === "blocked" && (
          <div className="mt-2 space-y-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={prereq.action.onClick}
              disabled={prereq.action.pending}
            >
              {prereq.action.pending && (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              )}
              {prereq.action.label}
            </Button>
            {prereq.action.error && (
              <p className="text-xs text-destructive">{prereq.action.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function RemoveLockup({
  lockupAccountId,
  ownerAccountId,
}: {
  lockupAccountId: string;
  ownerAccountId: string;
}) {
  const [step, setStep] = useState<Step>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [ownerPublicKey, setOwnerPublicKey] = useState<PublicKey | null>(null);
  const [tempPublicKey, setTempPublicKey] = useState<PublicKey | null>(null);
  const tempPrivateKeyRef = useRef<PrivateKey | null>(null);

  const { signMessageAsync } = useSignMessage();
  const { executeTransactionAsync } = useExecuteTransaction();

  const { prereqs, allOk, isLoading: prereqsLoading } =
    useRemovalPrerequisites(lockupAccountId);

  const handleError = useCallback((msg: string) => {
    setErrorMessage(msg);
    setStep("error");
  }, []);

  const startRemoval = () => setStep("confirm");
  const cancel = () => {
    setStep("idle");
    setErrorMessage("");
    setOwnerPublicKey(null);
    setTempPublicKey(null);
    tempPrivateKeyRef.current = null;
  };

  const doSignMessage = async () => {
    setStep("sign-message");
    try {
      const message = createMessage({
        message:
          "Confirm lockup removal — this signature proves you control the owner account key",
        recipient: lockupAccountId,
      });
      const result = await signMessageAsync({ message });
      setOwnerPublicKey(result.signerPublicKey);

      const tempKp = randomEd25519KeyPair();
      setTempPublicKey(tempKp.publicKey);
      tempPrivateKeyRef.current = tempKp.privateKey;

      setStep("add-keys");
    } catch (err) {
      handleError(
        err instanceof Error ? err.message : "Failed to sign message"
      );
    }
  };

  const doAddKeys = async () => {
    if (!ownerPublicKey || !tempPublicKey) return;
    try {
      await executeTransactionAsync({
        intent: {
          receiverAccountId: lockupAccountId,
          actions: [
            functionCall({
              functionName: "add_full_access_key",
              functionArgs: { new_public_key: ownerPublicKey },
              gasLimit: { teraGas: "50" },
            }),
            functionCall({
              functionName: "add_full_access_key",
              functionArgs: { new_public_key: tempPublicKey },
              gasLimit: { teraGas: "50" },
            }),
          ],
        },
      });
      setStep("delete");
    } catch (err) {
      handleError(
        err instanceof Error ? err.message : "Failed to add access keys"
      );
    }
  };

  const doDeleteAccount = async () => {
    if (!tempPrivateKeyRef.current) return;
    try {
      const client = createMainnetClient();
      const keyService = createMemoryKeyService({
        keySource: { privateKey: tempPrivateKeyRef.current },
      });
      const signer = createMemorySigner({
        signerAccountId: lockupAccountId,
        client,
        keyService,
      });

      await signer.executeTransaction({
        intent: {
          receiverAccountId: lockupAccountId,
          action: deleteAccount({
            beneficiaryAccountId: ownerAccountId,
          }),
        },
      });
      setStep("done");
    } catch (err) {
      handleError(
        err instanceof Error
          ? err.message
          : "Failed to delete lockup account"
      );
    }
  };

  // Idle state: show prerequisites first
  if (step === "idle") {
    return (
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Remove Lockup Account
          </CardTitle>
          <CardDescription>
            Permanently delete the lockup contract and send all remaining funds
            to your owner account. Complete all prerequisites first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium mb-2">Prerequisites</p>
            <div className="space-y-0 divide-y">
              {prereqs.map((p) => (
                <PrereqRow key={p.key} prereq={p} />
              ))}
            </div>
          </div>

          {!prereqsLoading && !allOk && (
            <Alert>
              <CircleAlert className="h-4 w-4" />
              <AlertDescription>
                Address every blocked prerequisite above before continuing.
                Staked or unstaked tokens left in the pool become{" "}
                <strong>permanently inaccessible</strong> once the lockup
                account is deleted.
              </AlertDescription>
            </Alert>
          )}

          <Button
            variant="destructive"
            onClick={startRemoval}
            className="w-full"
            disabled={!allOk || prereqsLoading}
          >
            {prereqsLoading
              ? "Checking prerequisites..."
              : allOk
                ? "Begin Lockup Removal"
                : "Prerequisites not met"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <Trash2 className="h-4 w-4" />
          Remove Lockup Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step overview */}
        <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
          <p className="text-sm font-medium">How this works:</p>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li className="flex items-start gap-2">
              <StepIndicator
                current={step}
                target={["confirm", "sign-message"]}
              />
              <span>
                <strong>Sign a message</strong> with your wallet to prove you
                own the account and to retrieve your public key.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <StepIndicator current={step} target={["add-keys"]} />
              <span>
                <strong>Add two full access keys</strong> to the lockup
                contract in a single transaction: your owner key (as backup)
                and a temporary key generated in this browser.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <StepIndicator current={step} target={["delete"]} />
              <span>
                <strong>Delete the lockup account</strong> using the temporary
                key, sending all remaining NEAR to your owner account (
                <span className="font-mono text-xs">{ownerAccountId}</span>).
              </span>
            </li>
          </ol>
        </div>

        {/* Confirm step */}
        {step === "confirm" && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This action is <strong>irreversible</strong>. The lockup
                contract account will be permanently deleted.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancel} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={doSignMessage}
                className="flex-1"
              >
                Continue &mdash; Sign Message
              </Button>
            </div>
          </div>
        )}

        {/* Sign message step */}
        {step === "sign-message" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for wallet signature...
          </div>
        )}

        {/* Add keys step */}
        {step === "add-keys" && (
          <div className="space-y-3">
            <Alert>
              <AlertDescription className="space-y-2">
                <p>
                  Message signed successfully. Your public key has been
                  retrieved.
                </p>
                <p className="font-mono text-xs break-all">
                  Owner key: {ownerPublicKey}
                </p>
                <p className="font-mono text-xs break-all">
                  Temporary key: {tempPublicKey}
                </p>
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              Next: approve a transaction that calls{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                add_full_access_key
              </code>{" "}
              twice on the lockup contract &mdash; once for each key above.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancel} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={doAddKeys}
                className="flex-1"
              >
                Add Keys to Lockup
              </Button>
            </div>
          </div>
        )}

        {/* Delete step */}
        {step === "delete" && (
          <div className="space-y-3">
            <Alert>
              <AlertDescription>
                Full access keys added to the lockup contract. The temporary
                browser key now has full access to the lockup account.
              </AlertDescription>
            </Alert>
            <p className="text-sm text-muted-foreground">
              Final step: delete the lockup account. All remaining NEAR will
              be sent to{" "}
              <span className="font-mono text-xs">{ownerAccountId}</span>.
              This transaction will be signed automatically using the
              temporary key.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancel} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={doDeleteAccount}
                className="flex-1"
              >
                Delete Lockup Account
              </Button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <Alert className="bg-emerald-500/10 border-emerald-500/20">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
            <AlertDescription className="text-emerald-700 dark:text-emerald-300">
              Lockup account deleted successfully. All remaining NEAR has been
              sent to{" "}
              <span className="font-mono text-xs">{ownerAccountId}</span>.
            </AlertDescription>
          </Alert>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={cancel} className="w-full">
              Start Over
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepIndicator({
  current,
  target,
}: {
  current: Step;
  target: Step[];
}) {
  const order: Step[] = [
    "confirm",
    "sign-message",
    "add-keys",
    "delete",
    "done",
  ];
  const currentIdx = order.indexOf(current);
  const targetIdx = Math.max(...target.map((t) => order.indexOf(t)));
  const firstTargetIdx = Math.min(...target.map((t) => order.indexOf(t)));

  if (currentIdx > targetIdx) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] px-1.5 py-0 shrink-0">
        Done
      </Badge>
    );
  }
  if (currentIdx >= firstTargetIdx && currentIdx <= targetIdx) {
    return (
      <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20 text-[10px] px-1.5 py-0 shrink-0">
        Current
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
      Pending
    </Badge>
  );
}
