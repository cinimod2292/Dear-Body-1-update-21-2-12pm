import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { sanitizeBuilderImageUrl } from "../media-url";

type VideoBannerProps = {
  title?: string;
  subtitle?: string;
  videoUrl?: string;
  posterUrl?: string;
  overlayOpacity?: "light" | "medium" | "dark";
  buttonText?: string;
  buttonHref?: string;
};

export function VideoBannerSection(props: VideoBannerProps) {
  const poster = sanitizeBuilderImageUrl(props.posterUrl) ?? "";
  const overlayClass =
    props.overlayOpacity === "light"
      ? "bg-black/20"
      : props.overlayOpacity === "dark"
        ? "bg-black/70"
        : "bg-black/45";

  return (
    <section className="relative min-h-[60vh] flex items-center overflow-hidden bg-gray-900">
      {props.videoUrl ? (
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={poster || undefined}
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        >
          <source src={props.videoUrl} />
        </video>
      ) : poster ? (
        <img
          src={poster}
          alt={props.title || "Video section"}
          className="absolute inset-0 w-full h-full object-cover opacity-70"
          loading="lazy"
        />
      ) : null}
      <div className={`absolute inset-0 ${overlayClass}`} />
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-20 text-center text-white w-full">
        {props.title ? (
          <h2 className="text-4xl font-black mb-4">{props.title}</h2>
        ) : null}
        {props.subtitle ? (
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">{props.subtitle}</p>
        ) : null}
        {props.buttonText ? (
          <Link
            to={props.buttonHref || "/shop"}
            className="px-8 py-3 rounded-full bg-white text-gray-900 font-bold inline-flex items-center gap-2 hover:opacity-90 transition"
          >
            {props.buttonText} <ArrowRight size={16} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
