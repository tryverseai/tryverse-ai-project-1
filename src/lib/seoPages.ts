/**
 * The single canonical list of TryVerse's public, indexable pages. Every consumer that needs to
 * know "what pages exist and what do they mean" reads from here instead of keeping its own copy:
 *  - <Seo> (src/components/Seo.tsx) resolves a page's title/description/canonical from this list.
 *  - The sitemap plugin (vite.config.ts) generates sitemap.xml straight from this list.
 * A page that isn't in this array is never written to the sitemap and never gets one of the
 * per-page <Seo> lookups — that's the mechanism that keeps login/signup/dashboard/admin out.
 *
 * `path` must exactly match the <Route path> in src/App.tsx. `changefreq`/`priority` are sitemap
 * hints only. Deliberately no `lastmod` field: we don't track real per-page edit dates, and a
 * fabricated one is worse than omitting the tag (see the Vite plugin below).
 */
export const SITE_ORIGIN = "https://tryverseai.com";

export interface PublicPage {
  path: string;
  title: string;
  description: string;
  changefreq: "weekly" | "monthly" | "yearly";
  priority: number;
}

export const PUBLIC_PAGES: PublicPage[] = [
  {
    path: "/",
    title: "TryVerse AI — AI Infrastructure for Fashion Commerce",
    description:
      "AI infrastructure for fashion commerce. TryVerse powers virtual try-on, AI models, product photography, AI photoshoots, and fashion video from a single platform, embedded directly in your storefront.",
    changefreq: "weekly",
    priority: 1.0,
  },
  {
    path: "/pricing",
    title: "Pricing — TryVerse AI Infrastructure for Fashion Visualization",
    description:
      "Plans for fashion brands using TryVerse's fashion visualization platform — virtual try-on, AI model photography, and outfit visualization, from free to enterprise.",
    changefreq: "monthly",
    priority: 0.9,
  },
  {
    path: "/technology",
    title: "Technology — TryVerse AI Infrastructure for Fashion Visualization",
    description:
      "The infrastructure behind fashion visualization — how TryVerse powers virtual try-on, AI-generated content, and commerce integration across storefronts, marketplaces, and applications.",
    changefreq: "monthly",
    priority: 0.8,
  },
  {
    path: "/about",
    title: "About — TryVerse AI Infrastructure for Fashion Visualization",
    description:
      "TryVerse builds AI infrastructure for fashion visualization — virtual try-on, AI model photography, and outfit visualization for online fashion commerce.",
    changefreq: "monthly",
    priority: 0.7,
  },
  {
    path: "/partner",
    title: "Partner With Us — TryVerse AI Infrastructure for Fashion Visualization",
    description:
      "Integrate TryVerse's fashion visualization platform into your commerce stack. Virtual try-on, AI model photography, and outfit visualization through APIs and SDKs.",
    changefreq: "monthly",
    priority: 0.7,
  },
  {
    path: "/enterprise-contact",
    title: "Enterprise — TryVerse AI Infrastructure for Fashion Visualization",
    description:
      "Talk to TryVerse about enterprise fashion visualization: custom infrastructure, SLAs, API/SDK integration, and volume pricing for large catalogues.",
    changefreq: "monthly",
    priority: 0.6,
  },
  {
    path: "/book-demo",
    title: "Book a Demo — TryVerse AI Infrastructure for Fashion Visualization",
    description:
      "See TryVerse's virtual try-on, AI models, and product photography live on your own catalogue. Book a demo with our team.",
    changefreq: "monthly",
    priority: 0.6,
  },
  {
    path: "/support",
    title: "Contact Us — TryVerse AI",
    description: "Contact TryVerse AI. Submit a request and our team will respond promptly.",
    changefreq: "monthly",
    priority: 0.5,
  },
  {
    path: "/terms",
    title: "Terms of Service — TryVerse AI",
    description: "The terms of service governing use of TryVerse's fashion visualization platform by business accounts.",
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    path: "/privacy",
    title: "Privacy Policy — TryVerse AI",
    description: "How TryVerse collects, uses, and protects personal information across its fashion visualization platform.",
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    path: "/data-processing",
    title: "Data Processing Agreement — TryVerse AI",
    description: "TryVerse's Data Processing Agreement (DPA) for customers who need one under applicable data-protection law.",
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    path: "/acceptable-use",
    title: "Acceptable Use Policy — TryVerse AI",
    description: "TryVerse's Acceptable Use & Responsible AI/Image Policy — what's permitted and prohibited on the platform.",
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    path: "/cookie-policy",
    title: "Cookie Policy — TryVerse AI",
    description: "How TryVerse uses cookies and similar technologies across its website and platform.",
    changefreq: "yearly",
    priority: 0.3,
  },
  {
    path: "/ai-image-notice",
    title: "AI & Image Processing Notice — TryVerse AI",
    description: "How TryVerse's AI models process uploaded and generated images to power virtual try-on and fashion visualization.",
    changefreq: "yearly",
    priority: 0.3,
  },
];

export function getPublicPage(path: string): PublicPage | undefined {
  return PUBLIC_PAGES.find((p) => p.path === path);
}

/**
 * index.html ships static `<link rel="canonical">`, `<meta name="description">`, and
 * `og:*`/`twitter:*` tags as a plain-HTML fallback for the instant before JS runs. Once React
 * mounts, every route's <Seo> component (src/components/Seo.tsx) renders its own page-scoped
 * versions via react-helmet-async — but Helmet only manages tags it renders itself; it does not
 * remove pre-existing ones. Left alone, every non-homepage route ends up with TWO of each tag
 * (the static homepage-only one, plus Helmet's correct one appended after it) — confirmed live:
 * `document.title` updated correctly (a true singleton Helmet replaces in place) while
 * `document.querySelector('link[rel="canonical"]')` kept returning the static homepage URL on
 * every other page, because querySelector returns the first match and the static tag is first in
 * DOM order. A duplicated/conflicting canonical is a known Google Search Console footgun (Google
 * documents that it may ignore canonical hints entirely when a page has more than one).
 *
 * Call this once at boot, before Helmet ever mounts, so the static fallbacks are gone before
 * Helmet inserts its own — exactly one of each survives, always the page-correct one.
 * `og:image` / `og:site_name` are page-invariant (Seo.tsx deliberately never re-declares them) and
 * are left alone, as is the JSON-LD.
 */
export function stripStaticPerPageHeadFallbacks(): void {
  if (typeof document === "undefined") return;
  const selectors = [
    'link[rel="canonical"]',
    'meta[name="description"]',
    'meta[property="og:type"]',
    'meta[property="og:url"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[name="twitter:card"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
  ];
  for (const selector of selectors) {
    document.head.querySelectorAll(selector).forEach((el) => el.remove());
  }
}
