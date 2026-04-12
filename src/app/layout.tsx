import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://near-lockup.trezu.org";
const TITLE = "NEAR Lockup Manager";
const TITLE_TEMPLATE = "%s — NEAR Lockup Manager";
const DESCRIPTION =
  "Manage your NEAR Protocol lockup contract: view accurate balances, stake with a validator, unstake, withdraw, and safely remove the lockup account — all from the browser.";
const KEYWORDS = [
  "NEAR",
  "NEAR Protocol",
  "lockup",
  "lockup contract",
  "staking",
  "stake delegation",
  "validator",
  "unstake",
  "withdraw",
  "vesting",
  "delete lockup",
  "remove lockup",
  "near.org",
  "web3",
  "dApp",
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: TITLE_TEMPLATE,
  },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: TITLE,
  category: "finance",
  authors: [{ name: "NEAR DevHub", url: "https://github.com/NEAR-DevHub" }],
  creator: "NEAR DevHub",
  publisher: "NEAR DevHub",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1024,
        height: 1384,
        alt: "NEAR Lockup Manager — dashboard overview",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
    creator: "@near_devhub",
    site: "@near_devhub",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  manifest: "/manifest.webmanifest",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "light dark",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: TITLE,
  url: SITE_URL,
  description: DESCRIPTION,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript and a NEAR-compatible wallet.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  creator: {
    "@type": "Organization",
    name: "NEAR DevHub",
    url: "https://github.com/NEAR-DevHub",
  },
  sameAs: [
    "https://github.com/NEAR-DevHub/near-lockup-manager",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          // Static JSON; no user input — safe to inline.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
