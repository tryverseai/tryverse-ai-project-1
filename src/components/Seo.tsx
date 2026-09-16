import { Helmet } from "react-helmet-async";
import { SITE_ORIGIN, getPublicPage } from "@/lib/seoPages";

interface SeoProps {
  /** Must match a `path` entry in src/lib/seoPages.ts (and the route in App.tsx). */
  path: string;
}

/**
 * One place that renders a page's <title>, meta description, canonical URL, and OG/Twitter tags —
 * every public page uses this instead of hand-writing its own <Helmet> block, so canonical/og:url
 * always point at THAT page (never silently inherit the homepage's) and the copy lives in exactly
 * one file (src/lib/seoPages.ts).
 */
export function Seo({ path }: SeoProps) {
  const page = getPublicPage(path);
  if (!page) {
    // Not a public page (e.g. this component was used on a private/dashboard route by mistake) —
    // render nothing rather than emit metadata for a URL that isn't in seoPages.ts / the sitemap.
    return null;
  }
  const url = `${SITE_ORIGIN}${page.path === "/" ? "/" : page.path}`;
  return (
    <Helmet>
      <title>{page.title}</title>
      <meta name="description" content={page.description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={page.title} />
      <meta property="og:description" content={page.description} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={page.title} />
      <meta name="twitter:description" content={page.description} />
    </Helmet>
  );
}
