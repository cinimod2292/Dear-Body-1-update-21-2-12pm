import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Star } from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { fetchStoreProducts, Product } from "../data/products";
import { fetchCmsBootstrap } from "../lib/cms";
import { resolveHeroImageConfig } from "../lib/hero-image-config";
import heroImageFallback from "../../assets/909142a9f8349273030b1d771262f7d833d21920.png";

const HERO_IMAGE_OPTIMIZED_PATH = "/assets/home-hero-optimized.webp";

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

export default function Home() {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const featuredProducts = useMemo(() => products.slice(0, 8), [products]);

  useEffect(() => {
    fetchStoreProducts()
      .then((items) => setProducts(items))
      .catch(() => setProducts([]));
  }, []);

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
      const heroImage = resolveHeroImageConfig(section.content, {
        pngFallbackUrl: heroImageFallback,
        optimizedFallbackUrl: HERO_IMAGE_OPTIMIZED_PATH,
      });
      const heroMobileUrl = String(section.content.backgroundImageMobileUrl || "");
      const heroSrcSet = String(section.content.backgroundImageSrcSet || "");
      return (
        <section key={section.id} className="relative min-h-[80vh] flex items-center overflow-hidden bg-gray-900">
          <div className="absolute inset-0">
            {heroImage.useCmsImage ? (
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
            ) : (
              <picture>
                <source srcSet={heroImage.optimizedFallbackUrl} type="image/webp" />
                <img
                  src={heroImage.pngFallbackUrl}
                  alt={section.title || "Hero"}
                  fetchPriority="high"
                  loading="eager"
                  decoding="async"
                  sizes="100vw"
                  width={1217}
                  height={797}
                  className="w-full h-full object-cover opacity-60"
                />
              </picture>
            )}
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
              {featuredProducts.slice(0, Number(section.content.limit || 8)).map((product, index) => <ProductCard key={product.id} product={product} prioritizeImage={index < 2} />)}
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

    if (section.type === "faq" || section.type === "testimonials") {
      const items = Array.isArray(section.content.items) ? (section.content.items as Array<{ question?: string; answer?: string; name?: string; quote?: string }>) : [];
      return (
        <section key={section.id} className="py-16 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <h3 className="text-3xl font-black text-gray-900 mb-8">{section.title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((item, idx) => (
                <div key={idx} className="border border-gray-100 rounded-xl p-4">
                  <p className="font-bold text-gray-900">{item.question || item.name}</p>
                  <p className="text-gray-600 mt-2">{item.answer || item.quote}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (section.type === "text_block" || section.type === "image_block") {
      return (
        <section key={section.id} className="py-14 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <h3 className="text-3xl font-black text-gray-900 mb-3">{section.title}</h3>
            <p className="text-gray-600">{section.subtitle || String(section.content.body || "")}</p>
            {section.type === "image_block" && section.content.imageUrl ? <img src={String(section.content.imageUrl)} alt={section.title || ""} loading="lazy" decoding="async" className="mt-6 mx-auto rounded-xl max-h-96 object-cover" /> : null}
          </div>
        </section>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen">
      {sections.length > 0
        ? sections.map((section, index) => {
          const rendered = renderSection(section);
          if (!rendered) return null;
          if (index < 2) return rendered;
          return <DeferredSection key={`deferred-${section.id}`}>{rendered}</DeferredSection>;
        })
        : null}
      <DeferredSection minHeight={160}>
        <section className="py-14 bg-gray-900 text-white">
          <div className="max-w-5xl mx-auto px-4 text-center">
            <p className="text-sm uppercase tracking-wide text-white/70 mb-2">Reviews</p>
            <div className="flex justify-center gap-1 mb-2">{Array.from({ length: 5 }).map((_, idx) => <Star key={idx} size={18} className="text-yellow-400 fill-yellow-400" />)}</div>
            <p className="text-white/80">Loved by thousands of customers worldwide.</p>
          </div>
        </section>
      </DeferredSection>
    </div>
  );
}
