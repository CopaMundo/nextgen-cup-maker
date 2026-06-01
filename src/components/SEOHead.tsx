import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  noIndex?: boolean;
  ogImage?: string;
}

const DOMAIN = "https://copa-mundo.lovable.app";
const DEFAULT_OG_IMAGE = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d706405b-2f50-48c4-818e-698a241d304c/id-preview-cbfad3d7--57ab0cc2-880f-4626-bafb-07bd33d2d19a.lovable.app-1774020933527.png";

const SEOHead = ({ title, description, canonical, noIndex = false, ogImage }: SEOHeadProps) => {
  useEffect(() => {
    // Title
    document.title = title;

    // Helper to set/create meta tags
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    // Description
    setMeta("name", "description", description);

    // Robots
    if (noIndex) {
      setMeta("name", "robots", "noindex,nofollow");
    } else {
      const existing = document.querySelector('meta[name="robots"]');
      if (existing) existing.remove();
    }

    // Canonical
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    const canonicalUrl = canonical ? `${DOMAIN}${canonical}` : undefined;
    if (canonicalUrl) {
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
      }
      link.setAttribute("href", canonicalUrl);
    } else if (link) {
      link.remove();
    }

    // Open Graph
    const img = ogImage || DEFAULT_OG_IMAGE;
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:image", img);
    setMeta("property", "og:url", canonicalUrl || DOMAIN);
    setMeta("property", "og:type", "website");

    // Twitter
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", img);

    return () => {
      // Cleanup canonical on unmount
      const c = document.querySelector('link[rel="canonical"]');
      if (c) c.remove();
      const r = document.querySelector('meta[name="robots"]');
      if (r) r.remove();
    };
  }, [title, description, canonical, noIndex, ogImage]);

  return null;
};

export default SEOHead;
