import { Link } from "react-router";

type SeoAuthoritySectionProps = {
  eyebrow?: string;
  title?: string;
  body?: string;
  points?: string[] | string;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  secondaryButtonText?: string;
  secondaryButtonHref?: string;
  tertiaryButtonText?: string;
  tertiaryButtonHref?: string;
  tone?: "white" | "soft" | "muted";
};

function listFromValue(value: string[] | string | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") return value.split("\n").map((item) => item.trim()).filter(Boolean);
  return [];
}

export function SeoAuthoritySection(props: SeoAuthoritySectionProps) {
  const points = listFromValue(props.points);
  const links = [
    { label: props.primaryButtonText, href: props.primaryButtonHref, className: "bg-pink-50 text-pink-700" },
    { label: props.secondaryButtonText, href: props.secondaryButtonHref, className: "bg-orange-50 text-orange-700" },
    { label: props.tertiaryButtonText, href: props.tertiaryButtonHref, className: "bg-gray-900 text-white" },
  ].filter((link): link is { label: string; href: string; className: string } => Boolean(link.label && link.href));
  const bg = props.tone === "soft" ? "bg-pink-50/30" : props.tone === "muted" ? "bg-gray-50" : "bg-white";

  return (
    <section className={`${bg} py-16`} aria-label={props.title || "SEO authority content"}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-[1.2fr_.8fr] items-start">
        <div>
          {props.eyebrow ? <p className="text-pink-600 font-bold text-sm uppercase tracking-wider mb-3">{props.eyebrow}</p> : null}
          {props.title ? <h2 className="text-3xl font-black text-gray-900 mb-4">{props.title}</h2> : null}
          {props.body ? <p className="text-gray-600 leading-relaxed mb-5">{props.body}</p> : null}
          {links.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {links.map((link) => (
                <Link key={link.href + link.label} to={link.href} className={`px-5 py-2 rounded-full font-bold text-sm ${link.className}`}>{link.label}</Link>
              ))}
            </div>
          ) : null}
        </div>
        {points.length > 0 ? (
          <div className="grid gap-3">
            {points.map((item) => (
              <div key={item} className="rounded-2xl border border-gray-100 bg-white p-4 text-sm font-semibold text-gray-700 shadow-sm">{item}</div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
