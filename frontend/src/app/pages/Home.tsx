import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowRight } from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { fetchStoreProducts, Product } from "../data/products";
import { fetchCmsBootstrap } from "../lib/cms";
import { resolveHeroImageConfig } from "../lib/hero-image-config";
import { BuilderPageRenderer } from "../builder/BuilderPageRenderer";
import { fetchAdminBuilderPage, fetchStoreBuilderPage } from "../builder/api";
import { BuilderPageContent } from "../builder/types";
import { getBuilderHeroImageUrl, heroPreloadDescriptor } from "../builder/hero-preload";
import { sanitizeBuilderImageUrl } from "../builder/media-url";
import { useSEO, buildCanonical } from "../lib/seo";

interface HomeSection {
  id: string;
  type: string;
  title?: string;
  subtitle?: string;
  content: Record<string, unknown>;
  enabled: boolean;
  order: number;
  status: "draft" | "published";
}

function DeferredSection({ children, minHeight = 280 }: { children: ReactNode; minHeight?: number }) {
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!anchor || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "350px 0px" },
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [anchor, visible]);

  return (
    <div ref={setAnchor}>
      {visible ? children : <div style={{ minHeight }} aria-hidden className="bg-transparent" />}
    </div>
  );
}

function LegacyHomeContent({ products }: { products: Product[] }) {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const featuredProducts = useMemo(() => products.slice(0, 8), [products]);

  useEffect(() => {
    fetchCmsBootstrap()
      .then((bootstrap) => {
        setSections(
          bootstrap.homeSections
            .filter((section) => section.enabled && section.status === "published")
            .sort((a, b) => a.order - b.order) as HomeSection[],
        );
      })
      .catch(() => {
        setSections([
          {
            id: "hero-default",
            type: "hero",
            title: "Dare to be Vibrant",
            subtitle: "Discover our bold collection of perfumed body sprays and skincare.",
            enabled: true,
            order: 0,
            status: "published",
            content: {},
          },
          {
            id: "featured-default",
            type: "featured_products",
            title: "Bestselling Products",
            subtitle: "Customer favorites.",
            enabled: true,
            order: 1,
            status: "published",
            content: {},
          },
        ]);
      });
  }, []);

  const renderSection = (section: HomeSection) => {
    if (section.type === "hero") {
      const heroImage = resolveHeroImageConfig(section.content);
      const heroMobileUrl = sanitizeBuilderImageUrl(section.content.backgroundImageMobileUrl, { isHero: true }) ?? "";
      const heroSrcSet = sanitizeBuilderImageUrl(section.content.backgroundImageSrcSet, { isHero: true }) ?? "";
      return (
        <section key={section.id} className="relative min-h-[80vh] flex items-center overflow-hidden bg-gray-900">
          <div className="absolute inset-0">
            {heroImage.imageUrl ? (
              <picture>
                {heroMobileUrl ? <source media="(max-width: 767px)" srcSet={heroMobileUrl} /> : null}
                {heroSrcSet ? <source srcSet={heroSrcSet} /> : null}
                <img
                  src={heroImage.imageUrl}
                  alt={section.title || "Hero"}
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  sizes="100vw"
                  className="w-full h-full object-cover opacity-60"
                />
              </picture>
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/60 to-transparent" />
          </div>
          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
            <div className="max-w-2xl text-white">
              {section.content.badge ? <span className="inline-block bg-white/10 rounded-full px-4 py-2 text-sm mb-6">{String(section.content.badge)}</span> : null}
              <h1 className="text-5xl font-black mb-5">{section.title || "Welcome"}</h1>
              <p className="text-lg text-gray-200 mb-8">{section.subtitle}</p>
              <div className="flex gap-3 flex-wrap">
                <Link to={String(section.content.ctaPrimaryHref || "/shop")} className="px-7 py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold inline-flex items-center gap-2">{String(section.content.ctaPrimaryLabel || "Shop Now")} <ArrowRight size={16} /></Link>
                <Link to={String(section.content.ctaSecondaryHref || "/shop")} className="px-7 py-3 rounded-full border border-white/30 text-white">{String(section.content.ctaSecondaryLabel || "Learn More")}</Link>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (section.type === "featured_products") {
      return (
        <section key={section.id} className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-black text-gray-900 mb-2">{section.title || "Featured Products"}</h2>
            <p className="text-gray-500 mb-8">{section.subtitle}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.slice(0, Number(section.content.limit || 8)).map((product) => <ProductCard key={product.id} product={product} prioritizeImage={false} />)}
            </div>
          </div>
        </section>
      );
    }

    if (section.type === "promo_banner" || section.type === "cta_block") {
      return (
        <section key={section.id} className="py-14 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 text-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h3 className="text-3xl font-black mb-3">{section.title}</h3>
            <p className="text-white/90 mb-6">{section.subtitle}</p>
            <Link to={String(section.content.ctaHref || "/shop")} className="px-8 py-3 rounded-full bg-white text-pink-600 font-bold inline-flex items-center gap-2">{String(section.content.ctaLabel || "Shop Now")} <ArrowRight size={16} /></Link>
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <>
      {sections.length > 0
        ? sections.map((section, index) => {
          const rendered = renderSection(section);
          if (!rendered) return null;
          if (index < 2) return rendered;
          return <DeferredSection key={`deferred-${section.id}`}>{rendered}</DeferredSection>;
        })
        : null}
    </>
  );
}

const HOME_SCHEMA = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Dear Body",
    url: typeof window !== "undefined" ? window.location.origin : "",
    logo: typeof window !== "undefined" ? `${window.location.origin}/logo.png` : "",
    description: "Dear Body is a South African beauty and fragrance brand offering premium body sprays, lotions, scrubs and skincare.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: "English",
    },
    sameAs: [],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Dear Body",
    url: typeof window !== "undefined" ? window.location.origin : "",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${typeof window !== "undefined" ? window.location.origin : ""}/shop?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },
];

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [builderContent, setBuilderContent] = useState<BuilderPageContent | null>(null);
  const [builderResolved, setBuilderResolved] = useState(false);
  const [searchParams] = useSearchParams();

  useSEO({
    title: "South African Beauty & Fragrance",
    description: "Discover Dear Body's luxurious range of perfumed body sprays, body lotions, scrubs and skincare. Free delivery on qualifying orders. Shop now.",
    canonical: buildCanonical("/"),
    ogType: "website",
    structuredData: HOME_SCHEMA,
  });

  // Builder SEO overrides are handled by useSEO hook above


  useEffect(() => {
    let cancelled = false;
    const isPreview = searchParams.get("preview") === "builder";
    if (isPreview) {
      const adminRaw = localStorage.getItem("dear-body-admin-session");
      let token: string | undefined;
      try {
        token = adminRaw ? (JSON.parse(adminRaw) as { accessToken?: string }).accessToken : undefined;
      } catch {
        token = undefined;
      }
      if (!token) {
        setBuilderContent(null);
        setBuilderResolved(true);
        return;
      }
      fetchAdminBuilderPage("home", token)
        .then((page) => {
          if (cancelled) return;
          setBuilderContent(page.draftContent);
          setBuilderResolved(true);
        })
        .catch(() => {
          if (cancelled) return;
          setBuilderContent(null);
          setBuilderResolved(true);
        });
      return () => { cancelled = true; };
    }

    fetchStoreBuilderPage("home")
      .then((page) => {
        if (cancelled) return;
        if (!page?.content?.sections?.length) {
          setBuilderContent(null);
          setBuilderResolved(true);
          return;
        }
        setBuilderContent(page.content);
        setBuilderResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setBuilderContent(null);
        setBuilderResolved(true);
      });
    return () => { cancelled = true; };
  }, [searchParams]);

  const needsProducts = useMemo(() => {
    if (!builderResolved) return false;
    if (!builderContent) return true;
    return builderContent.sections.some((section) => section.enabled !== false && section.type === "featured_products");
  }, [builderResolved, builderContent]);

  useEffect(() => {
    if (!needsProducts) {
      setProducts([]);
      return;
    }

    let cancelled = false;
    fetchStoreProducts()
      .then((items) => {
        if (cancelled) return;
        setProducts(items);
      })
      .catch(() => {
        if (cancelled) return;
        setProducts([]);
      });
    return () => { cancelled = true; };
  }, [needsProducts]);

  const heroPreloadUrl = useMemo(() => getBuilderHeroImageUrl(builderContent), [builderContent]);

  useEffect(() => {
    if (!heroPreloadUrl) return;
    const descriptor = heroPreloadDescriptor(heroPreloadUrl);
    const existing = document.head.querySelector<HTMLLinkElement>('link[data-builder-hero-preload="true"]');
    const link = existing ?? document.createElement("link");
    link.setAttribute("data-builder-hero-preload", "true");
    link.rel = descriptor.rel;
    link.as = descriptor.as;
    link.href = descriptor.href;
    link.setAttribute("imagesizes", descriptor.imagesizes);
    if (!existing) document.head.appendChild(link);
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, [heroPreloadUrl]);

  return (
    <div className="min-h-screen">
      {!builderResolved
        ? null
        : builderContent
        ? <BuilderPageRenderer content={builderContent} products={products} />
        : <LegacyHomeContent products={products} />}
    </div>
  );
}
