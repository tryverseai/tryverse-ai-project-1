import { describe, it, expect } from "vitest";
import { PUBLIC_PAGES, getPublicPage, SITE_ORIGIN } from "./seoPages";

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
