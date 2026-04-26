import { Link } from "react-router";
import { ProductCard } from "../../components/ProductCard";
import { Product } from "../../data/products";

type FeaturedProductsProps = {
  title: string;
  subtitle?: string;
  mode?: "manual" | "latest" | "featured";
  productIds?: string[];
  limit?: number;
  buttonText?: string;
  buttonHref?: string;
  products: Product[];
};

export function FeaturedProductsSection({ products, ...props }: FeaturedProductsProps) {
  const limit = Math.max(1, Math.min(12, Number(props.limit || 8)));
  const curated = (() => {
    if (props.mode === "manual" && Array.isArray(props.productIds) && props.productIds.length > 0) {
      const map = new Map(products.map((product) => [product.id, product]));
      return props.productIds.map((id) => map.get(id)).filter((item): item is Product => Boolean(item));
    }
    if (props.mode === "featured") {
      return products.filter((product) => product.badge).slice(0, limit);
    }
    return products.slice(0, limit);
  })();

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-black text-gray-900 mb-2">{props.title}</h2>
        {props.subtitle ? <p className="text-gray-500 mb-8">{props.subtitle}</p> : null}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {curated.slice(0, limit).map((product) => <ProductCard key={product.id} product={product} prioritizeImage={false} />)}
        </div>
        {props.buttonText ? <div className="mt-8 text-center"><Link to={props.buttonHref || "/shop"} className="px-7 py-3 rounded-full border border-gray-300 text-gray-800 font-semibold inline-flex">{props.buttonText}</Link></div> : null}
      </div>
    </section>
  );
}
