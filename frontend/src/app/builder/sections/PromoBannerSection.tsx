import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

type PromoBannerProps = {
  text: string;
  buttonText?: string;
  buttonHref?: string;
  tone?: "soft" | "clean" | "warm" | "bold";
};

export function PromoBannerSection(props: PromoBannerProps) {
  const toneClass = props.tone === "clean"
    ? "py-14 bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white"
    : props.tone === "soft"
      ? "py-14 bg-gradient-to-r from-fuchsia-400 via-pink-400 to-rose-400 text-white"
      : props.tone === "bold"
        ? "py-14 bg-gradient-to-r from-purple-700 via-pink-700 to-red-700 text-white"
        : "py-14 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 text-white";
  return (
    <section className={toneClass}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h3 className="text-3xl font-black mb-4">{props.text}</h3>
        {props.buttonText ? <Link to={props.buttonHref || "/shop"} className="px-8 py-3 rounded-full bg-white text-pink-600 font-bold inline-flex items-center gap-2">{props.buttonText} <ArrowRight size={16} /></Link> : null}
      </div>
    </section>
  );
}
