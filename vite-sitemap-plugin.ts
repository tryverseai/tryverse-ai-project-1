import { writeFileSync } from "fs";
import { resolve } from "path";
import type { Plugin, ResolvedConfig } from "vite";
import { PUBLIC_PAGES, SITE_ORIGIN } from "./src/lib/seoPages";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSitemapXml(): string {
  const urls = PUBLIC_PAGES.map((page) => {
    const loc = `${SITE_ORIGIN}${page.path}`;
    // No <lastmod> — we don't track real per-page edit dates, and a fabricated one is worse
    // than omitting the tag (a wrong lastmod can make crawlers de-prioritize a page that
    // actually changed, or waste budget re-fetching one that didn't).
    return [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <changefreq>${page.changefreq}</changefreq>`,
      `    <priority>${page.priority.toFixed(1)}</priority>`,
      "  </url>",
    ].join("\n");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

/**
 * Generates sitemap.xml at build time from the single canonical page list in src/lib/seoPages.ts
 * — the same list src/components/Seo.tsx reads per-page metadata from. A page only ever appears
 * here if it's in that array, which is how login/signup/dashboard/admin routes stay excluded
 * without a second, separately-maintained list that can drift (this replaced a hand-maintained
 * public/sitemap.xml that had gone stale — it still listed /early-access after that route became
 * a redirect to /book-demo).
 */
export function sitemapPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: "tryverse-sitemap",
    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },
    closeBundle() {
      const outPath = resolve(config.root, config.build.outDir, "sitemap.xml");
      writeFileSync(outPath, buildSitemapXml(), "utf8");
      // eslint-disable-next-line no-console -- build-time diagnostic, not app runtime logging.
      console.log(`[sitemap] wrote ${PUBLIC_PAGES.length} URLs to ${outPath}`);
    },
  };
}
