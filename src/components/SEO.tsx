import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description?: string;
  path?: string;
  ogImage?: string;
  ogImageAlt?: string;
  type?: string;
  noindex?: boolean;
  siteName?: string;
  locale?: string;
}

// Canonical base URL:
// 1. Prefer the live browser origin so tenant-specific domains resolve correctly.
// 2. Fall back to VITE_APP_URL for SSR / prerender contexts.
// 3. Last-resort fallback is intentionally left empty so links render as
//    relative paths rather than baking a single tenant's domain into SEO.
const BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : (import.meta.env.VITE_APP_URL ?? "");

const SEO = ({
  title,
  description = "",
  path = "/",
  ogImage = "/og-service.jpg",
  ogImageAlt,
  type = "website",
  noindex = false,
  siteName = "Harte Auto Group",
  locale = "en_US",
}: SEOProps) => {
  const url = `${BASE_URL}${path}`;
  const fullOgImage = ogImage.startsWith("http") ? ogImage : `${BASE_URL}${ogImage}`;
  const imageAlt = ogImageAlt || description || title;

  return (
    <Helmet>
      <html lang="en" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta
          name="robots"
          content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
        />
      )}

      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:image:alt" content={imageAlt} />
      <meta property="og:image:width" content="1344" />
      <meta property="og:image:height" content="768" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />
      <meta name="twitter:image:alt" content={imageAlt} />
    </Helmet>
  );
};

export default SEO;
