import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ownerAccountId: string }>;
}): Promise<Metadata> {
  const { ownerAccountId } = await params;
  const title = `${ownerAccountId} — NEAR Lockup Manager`;
  const description = `View and manage the NEAR lockup contract owned by ${ownerAccountId}: balances, staking delegation, withdrawal, and lockup removal.`;
  const canonical = `/${encodeURIComponent(ownerAccountId)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      title,
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
