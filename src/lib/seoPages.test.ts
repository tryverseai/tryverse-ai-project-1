import { describe, it, expect, afterEach } from "vitest";
import { PUBLIC_PAGES, getPublicPage, SITE_ORIGIN, stripStaticPerPageHeadFallbacks } from "./seoPages";

// This list is the single source both <Seo> and the sitemap build plugin read from — a typo'd
// path here silently produces a page with no metadata (falls through <Seo>'s null branch) or a
// sitemap entry for a URL that doesn't exist. Every path here must exactly match a <Route path>
// in src/App.tsx; that cross-check is manual (see the PR description) since parsing App.tsx's JSX
// here would be more fragile than the thing it's protecting against.
const EXPECTED_PATHS = [
  "/",
  "/pricing",
  "/technology",
  "/about",
  "/partner",
  "/enterprise-contact",
  "/book-demo",
  "/support",
  "/terms",
  "/privacy",
  "/data-processing",
  "/acceptable-use",
  "/cookie-policy",
  "/ai-image-notice",
];

describe("PUBLIC_PAGES", () => {
  it("contains exactly the intended public routes, no more, no fewer", () => {
    const paths = PUBLIC_PAGES.map((p) => p.path).sort();
    expect(paths).toEqual([...EXPECTED_PATHS].sort());
  });

  it("has no duplicate paths", () => {
    const paths = PUBLIC_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("excludes every private/auth/dashboard/admin route", () => {
    const excluded = ["/dashboard", "/admin", "/auth", "/forgot-password", "/reset-password", "/auth/verify-email"];
    for (const path of excluded) {
      expect(PUBLIC_PAGES.some((p) => p.path === path)).toBe(false);
    }
  });

  it("excludes the retired /early-access redirect stub (regression: it used to be listed here after becoming a redirect)", () => {
    expect(PUBLIC_PAGES.some((p) => p.path === "/early-access")).toBe(false);
  });

  it("every page has a non-empty title, description, valid priority and changefreq", () => {
    for (const page of PUBLIC_PAGES) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.description.length).toBeGreaterThan(0);
      expect(page.priority).toBeGreaterThan(0);
      expect(page.priority).toBeLessThanOrEqual(1);
      expect(["weekly", "monthly", "yearly"]).toContain(page.changefreq);
    }
  });

  it("no page declares its own lastmod (we don't fabricate edit dates)", () => {
    for (const page of PUBLIC_PAGES) {
      expect(page).not.toHaveProperty("lastmod");
    }
  });
});

describe("getPublicPage", () => {
  it("resolves every intended public path", () => {
    for (const path of EXPECTED_PATHS) {
      expect(getPublicPage(path)?.path).toBe(path);
    }
  });

  it("returns undefined for a private route", () => {
    expect(getPublicPage("/dashboard")).toBeUndefined();
  });

  it("returns undefined for an unknown path", () => {
    expect(getPublicPage("/does-not-exist")).toBeUndefined();
  });
});

describe("SITE_ORIGIN", () => {
  it("is the canonical apex host with no trailing slash", () => {
    expect(SITE_ORIGIN).toBe("https://tryverseai.com");
  });
});

describe("stripStaticPerPageHeadFallbacks", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  // Reproduces the real production bug: index.html ships static per-page-overridable tags for
  // the homepage as a pre-JS fallback; react-helmet-async never removes them, so every other
  // route ended up with two of each and document.querySelector (and Google) picked the wrong,
  // homepage-only one because it comes first in DOM order.
  function seedStaticIndexHtmlTags() {
    document.head.innerHTML = `
      <link rel="canonical" href="https://tryverseai.com/" />
      <meta name="description" content="homepage description" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://tryverseai.com/" />
      <meta property="og:title" content="homepage og title" />
      <meta property="og:description" content="homepage og description" />
      <meta property="og:image" content="https://tryverseai.com/og-image.jpg" />
      <meta property="og:site_name" content="TryVerse AI" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="homepage twitter title" />
      <meta name="twitter:description" content="homepage twitter description" />
    `;
  }

  it("removes every per-page-overridable static tag", () => {
    seedStaticIndexHtmlTags();
    stripStaticPerPageHeadFallbacks();

    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[name="description"]')).toBeNull();
    expect(document.querySelector('meta[property="og:type"]')).toBeNull();
    expect(document.querySelector('meta[property="og:url"]')).toBeNull();
    expect(document.querySelector('meta[property="og:title"]')).toBeNull();
    expect(document.querySelector('meta[property="og:description"]')).toBeNull();
    expect(document.querySelector('meta[name="twitter:card"]')).toBeNull();
    expect(document.querySelector('meta[name="twitter:title"]')).toBeNull();
    expect(document.querySelector('meta[name="twitter:description"]')).toBeNull();
  });

  it("leaves the page-invariant tags (og:image, og:site_name) alone", () => {
    seedStaticIndexHtmlTags();
    stripStaticPerPageHeadFallbacks();

    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      "https://tryverseai.com/og-image.jpg"
    );
    expect(document.querySelector('meta[property="og:site_name"]')?.getAttribute("content")).toBe("TryVerse AI");
  });

  it("is safe to call when there is nothing to strip", () => {
    expect(() => stripStaticPerPageHeadFallbacks()).not.toThrow();
  });
});
