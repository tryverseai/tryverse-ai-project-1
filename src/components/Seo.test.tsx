import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { Seo } from "./Seo";
import { getPublicPage } from "@/lib/seoPages";

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
