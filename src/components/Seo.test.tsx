import { describe, it, expect, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { Seo } from "./Seo";
import { getPublicPage, stripStaticPerPageHeadFallbacks } from "@/lib/seoPages";

function renderSeo(path: string) {
  return render(
    <HelmetProvider>
      <Seo path={path} />
    </HelmetProvider>
  );
}

describe("<Seo>", () => {
  it("renders the page's own title, description, and canonical — not the homepage's", async () => {
    renderSeo("/pricing");
    const page = getPublicPage("/pricing")!;

    await waitFor(() => {
      expect(document.title).toBe(page.title);
    });
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://tryverseai.com/pricing"
    );
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(page.description);
  });

  it("points og:url and twitter:title at the page's own URL, not the homepage", async () => {
    renderSeo("/technology");

    await waitFor(() => {
      expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(
        "https://tryverseai.com/technology"
      );
    });
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(
      getPublicPage("/technology")!.title
    );
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute("content")).toBe(
      getPublicPage("/technology")!.title
    );
  });

  it("renders correct, distinct metadata for the homepage itself", async () => {
    renderSeo("/");
    await waitFor(() => {
      expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://tryverseai.com/");
    });
  });

  it("renders nothing for a path that isn't in the public page list", () => {
    const { container } = renderSeo("/dashboard");
    expect(container.innerHTML).toBe("");
  });
});

describe("<Seo> against real index.html static fallback tags (production bug reproduction)", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  // This is the actual production sequence: index.html ships static per-page-overridable tags
  // for the homepage as a pre-JS fallback, main.tsx strips them at boot, THEN React mounts and
  // <Seo> renders via Helmet. Before the fix, skipping the strip step reproduced the live bug:
  // document.querySelector returned the static homepage tag (first in DOM order) instead of
  // Helmet's page-specific one, even though Helmet's own tag was present elsewhere in <head>.
  function seedStaticIndexHtmlTags() {
    document.head.innerHTML = `
      <title>TryVerse AI — AI Infrastructure for Fashion Commerce</title>
      <link rel="canonical" href="https://tryverseai.com/" />
      <meta name="description" content="homepage description" />
      <meta property="og:url" content="https://tryverseai.com/" />
      <meta property="og:title" content="homepage og title" />
      <meta property="og:image" content="https://tryverseai.com/og-image.jpg" />
      <meta name="twitter:title" content="homepage twitter title" />
    `;
  }

  it("leaves exactly one canonical/og:url/og:title/twitter:title in <head>, all pointing at the rendered page — not the homepage", async () => {
    seedStaticIndexHtmlTags();
    stripStaticPerPageHeadFallbacks();
    renderSeo("/pricing");
    const page = getPublicPage("/pricing")!;

    await waitFor(() => {
      expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    });
    expect(document.querySelectorAll('meta[property="og:url"]')).toHaveLength(1);
    expect(document.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(document.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(1);

    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://tryverseai.com/pricing"
    );
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute("content")).toBe(
      "https://tryverseai.com/pricing"
    );
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toBe(page.title);
    expect(document.querySelector('meta[name="twitter:title"]')?.getAttribute("content")).toBe(page.title);

    // The page-invariant fallback (never re-declared by <Seo>) must survive untouched.
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute("content")).toBe(
      "https://tryverseai.com/og-image.jpg"
    );
  });

  it("without the strip step, the bug reproduces: querySelector returns the stale static tag", async () => {
    seedStaticIndexHtmlTags();
    // Deliberately NOT calling stripStaticPerPageHeadFallbacks() here — this is the pre-fix
    // behavior, kept as a regression tripwire so this test starts failing (a good thing) if
    // someone ever removes the strip call from main.tsx.
    renderSeo("/pricing");

    await waitFor(() => {
      expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(2);
    });
    // First match in DOM order is the stale static one — this is the exact bug that shipped.
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://tryverseai.com/");
  });
});
