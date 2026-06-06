import { Link } from "react-router";
import { ArrowRight, Mail, Phone } from "lucide-react";

type ContactCtaProps = {
  title?: string;
  subtitle?: string;
  email?: string;
  phone?: string;
  buttonText?: string;
  buttonHref?: string;
  tone?: "dark" | "soft" | "warm";
};

export function ContactCtaSection(props: ContactCtaProps) {
  const isDark = !props.tone || props.tone === "dark";
  const bg = isDark
    ? "bg-gray-900 text-white"
    : props.tone === "warm"
      ? "bg-orange-50 text-gray-900"
      : "bg-pink-50 text-gray-900";
  const subColor = isDark ? "text-gray-300" : "text-gray-500";
  const contactColor = isDark
    ? "text-gray-200 hover:text-white"
    : "text-gray-700 hover:text-gray-900";

  return (
    <section className={`py-16 ${bg}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
        {props.title ? <h2 className="text-3xl font-black mb-2">{props.title}</h2> : null}
        {props.subtitle ? (
          <p className={`mb-8 ${subColor}`}>{props.subtitle}</p>
        ) : null}
        {(props.email || props.phone) ? (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
            {props.email ? (
              <a
                href={`mailto:${props.email}`}
                className={`inline-flex items-center gap-2 font-medium transition ${contactColor}`}
              >
                <Mail size={16} />
                {props.email}
              </a>
            ) : null}
            {props.phone ? (
              <a
                href={`tel:${props.phone}`}
                className={`inline-flex items-center gap-2 font-medium transition ${contactColor}`}
              >
                <Phone size={16} />
                {props.phone}
              </a>
            ) : null}
          </div>
        ) : null}
        {props.buttonText ? (
          <Link
            to={props.buttonHref || "/contact"}
            className="px-8 py-3 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold inline-flex items-center gap-2 hover:opacity-90 transition"
          >
            {props.buttonText} <ArrowRight size={16} />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
