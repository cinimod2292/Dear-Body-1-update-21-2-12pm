import { Link } from "react-router";
import { FaqItem } from "../types";

type SeoLandingSectionProps = {
  eyebrow?: string;
  title?: string;
  intro?: string;
  buyingGuide?: string[] | string;
  faqs?: FaqItem[];
  linkOneText?: string;
  linkOneHref?: string;
  linkTwoText?: string;
  linkTwoHref?: string;
  linkThreeText?: string;
  linkThreeHref?: string;
  tone?: "white" | "soft" | "muted" | "dark";
};

function listFromValue(value: string[] | string | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    return value.split("\n").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function SeoLandingSection(props: SeoLandingSectionProps) {
  const guideItems = listFromValue(props.buyingGuide);
  const faqs = Array.isArray(props.faqs) ? props.faqs.filter((item) => item.question && item.answer) : [];
  const links = [
    { label: props.linkOneText, href: props.linkOneHref },
    { label: props.linkTwoText, href: props.linkTwoHref },
    { label: props.linkThreeText, href: props.linkThreeHref },
  ].filter((link): link is { label: string; href: string } => Boolean(link.label && link.href));

  const bg =
    props.tone === "soft"
      ? "bg-pink-50/40"
      : props.tone === "muted"
        ? "bg-gray-50"
        : props.tone === "dark"
          ? "bg-gray-950"
          : "bg-white";
  const dark = props.tone === "dark";

  return (
    <section className={`py-16 ${bg}`} aria-label={props.title || "SEO landing content"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className={`rounded-3xl border p-8 shadow-sm ${dark ? "border-white/10 bg-white/5" : "border-gray-100 bg-white"}`}>
          <div className="max-w-4xl">
            {props.eyebrow ? <p className="text-pink-500 font-bold text-sm uppercase tracking-wider mb-2">{props.eyebrow}</p> : null}
            {props.title ? <h2 className={`text-2xl sm:text-3xl font-black mb-4 ${dark ? "text-white" : "text-gray-900"}`}>{props.title}</h2> : null}
            {props.intro ? <p className={`leading-relaxed mb-5 ${dark ? "text-gray-300" : "text-gray-600"}`}>{props.intro}</p> : null}
            {guideItems.length > 0 ? (
              <ul className="grid gap-3 md:grid-cols-3">
                {guideItems.map((item) => (
                  <li key={item} className={`rounded-2xl p-4 text-sm leading-relaxed ${dark ? "bg-white/10 text-gray-200" : "bg-pink-50/70 text-gray-700"}`}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        {(faqs.length > 0 || links.length > 0) ? (
          <div className="grid gap-8 lg:grid-cols-[1.4fr_.8fr]">
            {faqs.length > 0 ? (
              <div className={`rounded-3xl border p-8 shadow-sm ${dark ? "border-white/10 bg-white/5" : "border-gray-100 bg-white"}`}>
                <h3 className={`text-2xl font-black mb-5 ${dark ? "text-white" : "text-gray-900"}`}>Frequently asked questions</h3>
                <div className="space-y-5">
                  {faqs.map((faq) => (
                    <div key={faq.question}>
                      <h4 className={`font-bold mb-1 ${dark ? "text-white" : "text-gray-900"}`}>{faq.question}</h4>
                      <p className={`text-sm leading-relaxed ${dark ? "text-gray-300" : "text-gray-600"}`}>{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {links.length > 0 ? (
              <div className="bg-gray-900 rounded-3xl p-8 text-white shadow-sm">
                <h3 className="text-xl font-black mb-4">Continue exploring</h3>
                <p className="text-gray-300 text-sm leading-relaxed mb-5">Guide visitors and search engines to related Dear Body collections.</p>
                <div className="space-y-3">
                  {links.map((link) => (
                    <Link key={link.href + link.label} to={link.href} className="block rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-pink-500 transition-colors">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
