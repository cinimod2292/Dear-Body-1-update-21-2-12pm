import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

type PromoBannerProps = {
  text: string;
  buttonText?: string;
  buttonHref?: string;
};

export function PromoBannerSection(props: PromoBannerProps) {
  return (
    <section className="py-14 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h3 className="text-3xl font-black mb-4">{props.text}</h3>
        {props.buttonText ? <Link to={props.buttonHref || "/shop"} className="px-8 py-3 rounded-full bg-white text-pink-600 font-bold inline-flex items-center gap-2">{props.buttonText} <ArrowRight size={16} /></Link> : null}
      </div>
    </section>
  );
}
