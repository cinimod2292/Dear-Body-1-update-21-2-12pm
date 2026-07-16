import { Link } from "react-router";
import { CategorySeoContent } from "../lib/seo-content";

export function SeoLandingSections({ content, productsCount }: { content: CategorySeoContent; productsCount?: number }) {
  return (
    <section className="mt-14 space-y-8" aria-label="Shopping guide and frequently asked questions">
      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
        <div className="max-w-4xl">
          <p className="text-pink-600 font-bold text-sm uppercase tracking-wider mb-2">Dear Body buying guide</p>
          <h2 className="text-2xl font-black text-gray-900 mb-4">How to choose your fragrance and body care</h2>
          <p className="text-gray-600 leading-relaxed mb-5">{content.intro}</p>
          {typeof productsCount === "number" && (
            <p className="text-sm text-gray-500 mb-5">Browse {productsCount} curated option{productsCount === 1 ? "" : "s"} in this collection.</p>
          )}
          <ul className="grid gap-3 md:grid-cols-3">
            {content.buyingGuide.map((item) => (
              <li key={item} className="rounded-2xl bg-pink-50/70 p-4 text-sm text-gray-700 leading-relaxed">{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_.8fr]">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
          <h2 className="text-2xl font-black text-gray-900 mb-5">Frequently asked questions</h2>
          <div className="space-y-5">
            {content.faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="font-bold text-gray-900 mb-1">{faq.question}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-900 rounded-3xl p-8 text-white shadow-sm">
          <h2 className="text-xl font-black mb-4">Continue exploring</h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-5">Internal links help shoppers and search engines discover related Dear Body fragrance, perfume-inspired and body care collections.</p>
          <div className="space-y-3">
            {content.relatedLinks.map((link) => (
              <Link key={link.href + link.label} to={link.href} className="block rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-pink-500 transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
