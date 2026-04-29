import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { sanitizeBuilderImageUrl } from "../media-url";

type HeroBannerProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  imageMobileUrl?: string;
  imageAlt?: string;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
  layout?: "image_right" | "image_left" | "centered";
  tone?: "soft" | "clean" | "warm" | "bold";
};

export function HeroBannerSection(props: HeroBannerProps) {
  const titleAlign = props.layout === "centered"
    ? "text-center mx-auto"
    : props.layout === "image_left"
      ? "text-right ml-auto"
      : "";
  const imageUrl = sanitizeBuilderImageUrl(props.imageUrl, { isHero: true }) ?? "";
  const mobileImageUrl = sanitizeBuilderImageUrl(props.imageMobileUrl, { isHero: true }) ?? "";
  const overlayClass = props.tone === "clean"
    ? "bg-gradient-to-r from-gray-900/80 via-gray-900/40 to-transparent"
    : props.tone === "warm"
      ? "bg-gradient-to-r from-orange-900/70 via-pink-900/50 to-transparent"
      : props.tone === "bold"
        ? "bg-gradient-to-r from-black/90 via-fuchsia-900/60 to-transparent"
        : "bg-gradient-to-r from-gray-900/90 via-gray-900/60 to-transparent";

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden bg-gray-900">
      <div className="absolute inset-0">
        {imageUrl
          ? <img src={imageUrl} srcSet={mobileImageUrl ? `${mobileImageUrl} 768w, ${imageUrl} 1920w` : undefined} alt={props.imageAlt || props.title} className="w-full h-full object-cover opacity-60" fetchPriority="high" loading="eager" decoding="async" sizes="100vw" width={1217} height={797} />
          : null}
        <div className={`absolute inset-0 ${overlayClass}`} />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
        <div className={`max-w-2xl text-white ${titleAlign}`}>
          {props.eyebrow ? <span className="inline-block bg-white/10 rounded-full px-4 py-2 text-sm mb-6">{props.eyebrow}</span> : null}
          <h1 className="text-5xl font-black mb-5">{props.title}</h1>
          {props.subtitle ? <p className="text-lg text-gray-200 mb-8">{props.subtitle}</p> : null}
          <div className="flex gap-3 flex-wrap">
            <Link to={props.primaryButtonHref || "/shop"} className="px-7 py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold inline-flex items-center gap-2">{props.primaryButtonText || "Shop Now"} <ArrowRight size={16} /></Link>
            {props.secondaryButtonText ? <Link to={props.secondaryButtonHref || "/shop"} className="px-7 py-3 rounded-full border border-white/30 text-white">{props.secondaryButtonText}</Link> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
