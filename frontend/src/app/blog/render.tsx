import { Link } from "react-router";
import { BlogArticle, BlogBlock } from "./api";

export function readingDate(value?: string) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)) : "Draft"; }
export function tableOfContents(blocks: BlogBlock[] = []) { return blocks.filter((b) => b.type.startsWith("heading") && b.text).map((b, i) => ({ id: `section-${i}`, text: b.text!, level: b.level || Number(b.type.replace("heading", "")) || 2 })); }
export function articleJsonLd(article: BlogArticle) { return { "@context": "https://schema.org", "@type": "Article", headline: article.seoTitle || article.title, description: article.metaDescription || article.excerpt, image: article.heroImageUrl, author: { "@type": "Person", name: article.author?.name || "Dear Body" }, datePublished: article.publishedAt, dateModified: article.updatedAt, mainEntityOfPage: `/blog/${article.slug}` }; }
export function faqJsonLd(article: BlogArticle) { const faqs = article.faqs || article.body.flatMap((b) => b.faqs || []); return faqs.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) } : null; }

export function ArticleCard({ article, featured = false }: { article: BlogArticle; featured?: boolean }) {
  return <Link to={`/blog/${article.slug}`} className={`group block overflow-hidden rounded-3xl border border-pink-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${featured ? "md:grid md:grid-cols-2" : ""}`}>
    <img src={article.heroImageUrl || "/og-dear-body.svg"} alt={article.heroImageAlt || article.title} loading={featured ? "eager" : "lazy"} className="h-56 w-full object-cover" />
    <div className="p-6">
      <p className="text-xs font-bold uppercase tracking-wide text-pink-600">{article.category?.name || "Dear Body"} · {article.readingTime} min read</p>
      <h2 className="mt-2 text-2xl font-black text-gray-950 group-hover:text-pink-600">{article.title}</h2>
      <p className="mt-3 text-sm text-gray-600">{article.excerpt}</p>
      <p className="mt-4 text-xs text-gray-500">{article.author?.name || "Dear Body Editorial"} · {readingDate(article.publishedAt)} · {article.products?.length || 0} products</p>
    </div>
  </Link>;
}

export function RenderBlocks({ blocks, products = [] }: { blocks: BlogBlock[]; products?: any[] }) {
  return <>{blocks.map((b, i) => {
    if (b.type.startsWith("heading")) { const H = (`h${b.level || b.type.replace("heading", "") || 2}` as keyof JSX.IntrinsicElements); return <H id={`section-${i}`} key={i} className="scroll-mt-24 text-3xl font-black mt-10 mb-4 text-gray-950">{b.text}</H>; }
    if (b.type === "paragraph") return <p key={i} className="my-5 leading-8 text-gray-700">{b.text}</p>;
    if (b.type === "image") return <figure key={i} className="my-8"><img src={b.url} alt={b.alt || b.caption || "Dear Body blog image"} loading="lazy" className="rounded-3xl w-full"/><figcaption className="text-center text-xs text-gray-500 mt-2">{b.caption}</figcaption></figure>;
    if (b.type === "list") return <ul key={i} className="my-6 list-disc pl-6 space-y-2 text-gray-700">{b.items?.map((x) => <li key={x}>{x}</li>)}</ul>;
    if (b.type === "quote") return <blockquote key={i} className="my-8 border-l-4 border-pink-400 pl-5 text-xl font-semibold text-gray-800">{b.text}</blockquote>;
    if (b.type === "callout") return <div key={i} className="my-8 rounded-3xl bg-pink-50 p-6 text-pink-950 border border-pink-100"><b>Dear Body tip:</b> {b.text}</div>;
    if (b.type === "button") return <Link key={i} to={b.href || "/shop"} className="inline-flex rounded-full bg-gray-950 px-6 py-3 text-white font-bold">{b.label || "Shop now"}</Link>;
    if (b.type === "faq") return <div key={i} className="my-8 space-y-3">{b.faqs?.map((f) => <details key={f.question} className="rounded-2xl border p-4"><summary className="font-bold">{f.question}</summary><p className="mt-2 text-gray-600">{f.answer}</p></details>)}</div>;
    if (b.type === "product") { const p = products.find((x:any) => x.product?.id === b.productId)?.product; return p ? <Link key={i} to={`/product/${p.slug || p.id}`} className="my-6 flex gap-4 rounded-3xl border p-4"><img src={p.galleries?.[0]?.mediaAsset?.publicUrl || "/og-dear-body.svg"} alt={p.name} className="h-24 w-24 rounded-2xl object-cover"/><div><b>{p.name}</b><p className="text-sm text-gray-600">{p.shortDescription}</p><span className="text-pink-600 font-bold">View product</span></div></Link> : null; }
    if (b.type === "html") return <div key={i} dangerouslySetInnerHTML={{ __html: b.html || "" }} />;
    return null;
  })}</>;
}
