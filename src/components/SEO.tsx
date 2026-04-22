import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description?: string;
  path?: string;
  ogImage?: string;
  type?: string;
  noindex?: boolean;
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
  type = "website",
  noindex = false,
}: SEOProps) => {
  const url = `${BASE_URL}${path}`;
  const fullOgImage = ogImage.startsWith("http") ? ogImage : `${BASE_URL}${ogImage}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={fullOgImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />
    </Helmet>
  );
};

export default SEO;
