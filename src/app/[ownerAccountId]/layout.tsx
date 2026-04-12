import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ownerAccountId: string }>;
}): Promise<Metadata> {
  const { ownerAccountId } = await params;
  // The root layout sets a `%s — NEAR Lockup Manager` template; pass just the
  // account id so the composed page title becomes
  // "end2.near — NEAR Lockup Manager" (not doubly-suffixed).
  const title = ownerAccountId;
  const fullTitle = `${ownerAccountId} — NEAR Lockup Manager`;
  const description = `View and manage the NEAR lockup contract owned by ${ownerAccountId}: balances, staking delegation, withdrawal, and lockup removal.`;
  const canonical = `/${encodeURIComponent(ownerAccountId)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      title: fullTitle,
      description,
      card: "summary_large_image",
    },
  };
}

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
