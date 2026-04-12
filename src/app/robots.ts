import type { MetadataRoute } from "next";

const SITE_URL = "https://near-lockup.trezu.org";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Per-account dynamic pages are valid destinations but there's no
        // useful crawl target for them, so discourage indexing the long tail.
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
