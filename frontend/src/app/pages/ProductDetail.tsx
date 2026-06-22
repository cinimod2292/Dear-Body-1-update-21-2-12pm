import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { ShoppingBag, Heart, Star, ArrowLeft, Truck, Shield, RotateCcw, Minus, Plus, Check, MessageCircle } from "lucide-react";
import { fetchStoreProductById, fetchStoreProductsByQuery, Product } from "../data/products";
import { useCart } from "../context/CartContext";
import { ProductCard } from "../components/ProductCard";
import { useFavorites } from "../context/FavoritesContext";
import { formatRand } from "../lib/currency";
import { Dialog, DialogContent, DialogTitle } from "../components/ui/dialog";
import { deriveGalleryImages, type ProductDetailImage } from "../lib/product-detail-images";
import { getGalleryMainSources, getLightboxSources, getThumbImageSources } from "../lib/product-images";
import { useSEO, buildCanonical } from "../lib/seo";
import { trackViewItem, trackAddToCart } from "../lib/analytics";
import { ProductReviews } from "../components/ProductReviews";
import { ProductFaqSection } from "../components/ProductFaqSection";
import { resolveProductDetailTabs } from "../lib/product-detail-tabs";

function buildProductSchema(product: Product, canonicalUrl: string) {
  const firstImage = product.galleryImages?.[0]?.url || product.image;
  const productSchema: any = {
    "@type": "Product",
    name: product.name,
    description: product.description || product.tagline,
    url: canonicalUrl,
    sku: product.id,
    image: firstImage ? [firstImage] : undefined,
    brand: product.brand ? {
      "@type": "Brand",
      name: product.brand,
    } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "ZAR",
      price: product.price.toFixed(2),
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: canonicalUrl,
      seller: { "@type": "Organization", name: "Dear Body" },
    },
  };

  if (product.reviews > 0 && product.rating > 0) {
    productSchema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating.toFixed(1),
      reviewCount: product.reviews,
      bestRating: "5",
      worstRating: "1",
    };
  }

  const breadcrumb = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: buildCanonical("/") },
      { "@type": "ListItem", position: 2, name: "Shop", item: buildCanonical("/shop") },
      ...(product.category ? [{ "@type": "ListItem", position: 3, name: product.category, item: buildCanonical(`/shop?category=${encodeURIComponent(product.category)}`) }] : []),
      { "@type": "ListItem", position: product.category ? 4 : 3, name: product.name, item: canonicalUrl },
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [productSchema, breadcrumb],
  };
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isFavorited, toggleFavorite } = useFavorites();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const canonicalUrl = product ? buildCanonical(`/product/${product.slug || id}`) : "";
  const productSchema = product ? buildProductSchema(product, canonicalUrl) : null;

  useSEO(product ? {
    title: product.seoTitle || product.name,
    description: product.seoDescription || product.tagline || product.description?.slice(0, 160),
    canonical: canonicalUrl,
    ogType: "product",
    ogImage: product.seoOgImage || product.galleryImages?.[0]?.url || product.image,
    structuredData: productSchema || undefined,
  } : { title: "Product", noIndex: true });

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "ingredients" | "howToUse">("description");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [renderRelatedSection, setRenderRelatedSection] = useState(false);
  const [relatedAnchor, setRelatedAnchor] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) return;
    let isCancelled = false;

    setLoading(true);
    setRelated([]);
    fetchStoreProductById(id)
      .then((foundProduct) => {
        if (isCancelled) return;
        setProduct(foundProduct);
        setActiveImageIndex(0);
        // Fire analytics product view event
        if (foundProduct) {
          trackViewItem({
            id: foundProduct.id,
            name: foundProduct.name,
            price: foundProduct.price,
            brand: foundProduct.brand,
            category: foundProduct.category,
            currency: "ZAR",
          });
        }
        setLightboxOpen(false);
        setLoading(false);

        if (!foundProduct?.categoryId) return;
        fetchStoreProductsByQuery({ categoryId: foundProduct.categoryId, perPage: 8, sortBy: "updatedAt", sortDir: "desc" })
          .then((items) => {
            if (isCancelled) return;
            setRelated(items.filter((item) => item.id !== foundProduct.id).slice(0, 4));
          })
          .catch(() => {
            if (isCancelled) return;
            setRelated([]);
          });
      })
      .catch(() => {
        if (isCancelled) return;
        setProduct(null);
        setRelated([]);
        setLoading(false);
      })
      .finally(() => {
        if (isCancelled) return;
        setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [id]);

  const handleAddToCart = () => {
    const currentProduct = product;
    if (!currentProduct?.variantId || !currentProduct.inStock) return;
    addToCart(currentProduct, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    trackAddToCart({
      id: currentProduct.id,
      name: currentProduct.name,
      price: currentProduct.price,
      quantity,
      brand: currentProduct.brand,
      category: currentProduct.category,
      currency: "ZAR",
    });
  };

  const handleBuyNow = () => {
    const currentProduct = product;
    if (!currentProduct?.variantId || !currentProduct.inStock) return;
    addToCart(currentProduct, quantity);
    navigate("/cart");
  };

  const savings = product?.originalPrice ? (product.originalPrice - product.price) * quantity : null;
  const wished = product ? isFavorited(product.id) : false;
  const galleryImages: ProductDetailImage[] = deriveGalleryImages(product ? {
    galleryImages: product.galleryImages,
    images: product.images,
    image: product.image,
  } : null);
  const safeActiveImageIndex = galleryImages.length ? Math.min(activeImageIndex, galleryImages.length - 1) : 0;
  const currentImage = galleryImages[safeActiveImageIndex]
    ?? galleryImages[0]
    ?? { url: product?.image ?? "" };
  const currentMainSources = getGalleryMainSources(currentImage);
  const currentLightboxSources = getLightboxSources(currentImage);
  const currentMainSrc = currentMainSources?.src ?? currentImage.mainUrl ?? currentImage.url;
  const currentLightboxSrc = currentLightboxSources?.src ?? currentImage.lightboxUrl ?? currentImage.main2xUrl ?? currentImage.mainUrl ?? currentImage.url;

  useEffect(() => {
    if (!galleryImages.length) {
      if (activeImageIndex !== 0) setActiveImageIndex(0);
      if (lightboxOpen) setLightboxOpen(false);
      return;
    }
    if (activeImageIndex > galleryImages.length - 1) {
      setActiveImageIndex(galleryImages.length - 1);
    }
  }, [activeImageIndex, galleryImages.length, lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen || !galleryImages.length) return;
    const neighborIndexes = [
      activeImageIndex,
      (activeImageIndex + 1) % galleryImages.length,
      (activeImageIndex - 1 + galleryImages.length) % galleryImages.length,
    ];
    neighborIndexes.forEach((index) => {
      const src = getLightboxSources(galleryImages[index])?.src ?? galleryImages[index]?.lightboxUrl ?? galleryImages[index]?.main2xUrl ?? galleryImages[index]?.mainUrl ?? galleryImages[index]?.url;
      if (!src) return;
      const preload = new Image();
      preload.decoding = "async";
      preload.src = src;
    });
  }, [activeImageIndex, galleryImages, lightboxOpen]);

  useEffect(() => {
    if (!relatedAnchor || renderRelatedSection) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRenderRelatedSection(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(relatedAnchor);
    return () => observer.disconnect();
  }, [relatedAnchor, renderRelatedSection]);

  const badgeColors: Record<string, string> = {
    SALE: "bg-red-500",
    BESTSELLER: "bg-pink-500",
    NEW: "bg-lime-500",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }} className="text-gray-800">Loading product…</h2>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-6xl">🌈</p>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }} className="text-gray-800">Product not found</h2>
        <Link to="/shop" className="px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold">
          Back to Shop
        </Link>
      </div>
    );
  }

  // Only surface detail tabs that actually have content, so incomplete products
  // don't render empty "Ingredients" / "How To Use" sections on the storefront.
  const detailTabs = resolveProductDetailTabs(product);
  const activeDetailTab = detailTabs.find((tab) => tab.key === activeTab) ?? detailTabs[0];

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-4">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Link to="/" className="hover:text-pink-500 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-pink-500 transition-colors">Shop</Link>
          <span>/</span>
          <Link to={`/shop?category=${product.category}`} className="hover:text-pink-500 transition-colors">{product.category}</Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14">

          {/* ── Image Panel ── */}
          <div className="relative">
            <button
              onClick={() => navigate(-1)}
              className="absolute top-0 left-0 z-10 flex items-center gap-2 text-gray-600 hover:text-pink-500 transition-colors font-medium text-sm"
            >
              <ArrowLeft size={16} /> Back
            </button>

            <div
              className="rounded-3xl overflow-hidden mt-8 aspect-square relative shadow-xl"
              style={{ backgroundColor: product.bgColor }}
            >
              <img
                src={currentMainSrc}
                alt={product.name}
                className="w-full h-full object-cover cursor-zoom-in"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                width={currentImage.width ?? product.imageWidth}
                height={currentImage.height ?? product.imageHeight}
                sizes="(min-width: 1024px) 48vw, 95vw"
                srcSet={currentMainSources?.srcSet ?? (currentImage.main2xUrl ? `${currentMainSrc} 1x, ${currentImage.main2xUrl} 2x` : undefined)}
                onClick={() => setLightboxOpen(Boolean(galleryImages.length))}
              />

              {/* Badge */}
              {product.badge && (
                <div className={`absolute top-5 left-5 ${badgeColors[product.badge]} text-white px-4 py-1.5 rounded-full text-sm font-bold`}>
                  {product.badge}
                </div>
              )}

              {/* Wishlist */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleFavorite(product.id);
                }}
                aria-label={wished ? "Remove from favorites" : "Add to favorites"}
                className={`absolute top-5 right-5 z-10 w-11 h-11 cursor-pointer rounded-full flex items-center justify-center shadow-lg transition-all ${wished ? "bg-pink-500 text-white" : "bg-white text-gray-400 hover:text-pink-500"}`}
              >
                <Heart size={20} fill={wished ? "currentColor" : "none"} />
              </button>
            </div>
            {galleryImages.length > 1 && (
              <div className="mt-4 grid grid-cols-5 gap-2">
                {galleryImages.map((image, index) => {
                  const thumbSources = getThumbImageSources(image);
                  return (
                    <button
                      key={`${image.url}-${index}`}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      className={`aspect-square overflow-hidden rounded-xl border-2 ${index === activeImageIndex ? "border-pink-500" : "border-transparent"}`}
                    >
                      <img
                        src={thumbSources?.src ?? image.thumbUrl ?? image.url}
                        alt={`${product.name} thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        width={thumbSources?.width ?? image.width}
                        height={thumbSources?.height ?? image.height}
                        sizes="96px"
                      />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Scent tags */}
            <div className="flex flex-wrap gap-2 mt-5">
              {[product.scent, product.category, "Vegan", "Cruelty-Free"].filter(Boolean).map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{ backgroundColor: product.bgColor, color: product.textColor }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* ── Product Info ── */}
          <div className="flex flex-col gap-5 pt-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: product.color }}>
                my DEAR BODY · {product.category}
              </p>
              <h1 className="text-gray-900 mb-2" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, lineHeight: 1.1 }}>
                {product.name}
              </h1>
              <p className="text-gray-500 text-lg italic">{product.tagline}</p>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={18}
                    className={i < Math.floor(product.rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}
                  />
                ))}
              </div>
              <span className="font-bold text-gray-800">{product.rating}</span>
              <span className="text-gray-400 text-sm">({product.reviews} reviews)</span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="font-black text-3xl" style={{ color: product.textColor }}>{formatRand(product.price)}</span>
              {product.originalPrice && (
                <>
                  <span className="text-gray-400 line-through text-lg">{formatRand(product.originalPrice)}</span>
                  <span className="text-red-500 font-bold text-sm bg-red-50 px-2 py-1 rounded-full">
                    SAVE {Math.round((1 - product.price / product.originalPrice) * 100)}%
                  </span>
                </>
              )}
            </div>

            <p className="text-gray-500 text-sm">{product.size}</p>

            {/* Quantity */}
            <div>
              <p className="text-gray-700 font-bold mb-3">Quantity</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center border-2 border-gray-200 rounded-full overflow-hidden">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="w-11 h-11 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-10 text-center font-bold text-gray-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="w-11 h-11 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {savings && (
                  <span className="text-green-600 text-sm font-medium">You save {formatRand(savings)}!</span>
                )}
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!product.variantId || !product.inStock}
                className={`flex-1 py-4 rounded-full font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                  added
                    ? "bg-green-500 text-white"
                    : product.variantId && product.inStock
                      ? "bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:opacity-90 hover:scale-[1.02] shadow-lg shadow-pink-200"
                      : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
              >
                {added ? <><Check size={18} /> Added to Cart!</> : <><ShoppingBag size={18} /> {product.variantId && product.inStock ? "Add to Cart" : "Unavailable"}</>}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={!product.variantId || !product.inStock}
                className="flex-1 py-4 rounded-full font-bold border-2 text-gray-800 hover:border-pink-400 hover:text-pink-500 transition-all duration-200"
                style={{ borderColor: product.color }}
              >
                Buy Now
              </button>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 py-4 border-t border-b border-gray-100">
              {[
                { icon: Truck, label: "Free Shipping", sub: "Orders R50+" },
                { icon: RotateCcw, label: "30-Day Returns", sub: "Hassle-free" },
                { icon: Shield, label: "Secure Payment", sub: "100% Protected" },
              ].map(b => (
                <div key={b.label} className="flex flex-col items-center text-center gap-1">
                  <b.icon size={20} className="text-pink-500" />
                  <p className="text-xs font-bold text-gray-700">{b.label}</p>
                  <p className="text-xs text-gray-400">{b.sub}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            {detailTabs.length > 0 && (
              <div>
                <div className="flex gap-0 border-b border-gray-200 mb-5">
                  {detailTabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-5 py-3 text-sm font-bold transition-colors border-b-2 -mb-px ${
                        activeDetailTab?.key === tab.key
                          ? "border-pink-500 text-pink-500"
                          : "border-transparent text-gray-400 hover:text-gray-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
                  {activeDetailTab?.content}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── FAQs ── */}
        <ProductFaqSection productId={product.id} />

        {/* ── Reviews ── */}
        <ProductReviews
          productId={product.id}
          productName={product.name}
          initialRating={product.rating}
          initialCount={product.reviews}
        />

        {/* ── WhatsApp CTA ── */}
        <div className="mt-8 flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl p-4">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
            <MessageCircle size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm">Have a question about this product?</p>
            <p className="text-gray-500 text-xs">Our team is ready to help via WhatsApp</p>
          </div>
          <a
            href={`https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER || "27000000000"}?text=${encodeURIComponent(`Hi! I have a question about: ${product.name}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm font-bold transition-colors"
          >
            Chat Now
          </a>
        </div>

        {/* ── Related Products ── */}
        <div ref={setRelatedAnchor} className="mt-20">
          {related.length > 0 && renderRelatedSection ? (
            <>
              <h2 className="text-gray-900 mb-8 text-center" style={{ fontSize: "2rem", fontWeight: 900 }}>
                You Might Also Love 💕
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {related.map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </>
          ) : <div style={{ minHeight: 220 }} aria-hidden className="bg-transparent" />}
        </div>
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl p-4 bg-white">
          <DialogTitle className="sr-only">{product.name} image gallery</DialogTitle>
          <div className="relative">
            <img
              src={currentLightboxSrc}
              alt={product.name}
              className="w-full max-h-[80vh] object-contain rounded-lg bg-gray-50"
              loading="eager"
              decoding="async"
              fetchPriority="high"
              width={currentImage.width ?? product.imageWidth}
              height={currentImage.height ?? product.imageHeight}
              sizes="100vw"
              srcSet={currentLightboxSources?.srcSet ?? (currentImage.lightbox2xUrl ? `${currentLightboxSrc} 1x, ${currentImage.lightbox2xUrl} 2x` : undefined)}
            />
            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((idx) => (idx === 0 ? galleryImages.length - 1 : idx - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 shadow"
                  aria-label="Previous image"
                >
                  <ArrowLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveImageIndex((idx) => (idx + 1) % galleryImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 rounded-full p-2 shadow"
                  aria-label="Next image"
                >
                  <ArrowLeft size={20} className="rotate-180" />
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
