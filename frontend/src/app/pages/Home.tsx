import { Link } from "react-router";
import { ArrowRight, Sparkles, Truck, RotateCcw, Shield, Star } from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { products } from "../data/products";
import { useState } from "react";
import heroImage from "figma:asset/909142a9f8349273030b1d771262f7d833d21920.png";

const sprayProducts = products.filter(p => p.category === "Body Spray");
const featuredProducts = products.slice(0, 4);

const testimonials = [
  { id: 1, name: "Sophia R.", rating: 5, text: "Rocking Fantasy is literally my signature scent now! Everyone always asks what I'm wearing. Obsessed 💙", product: "Rocking Fantasy", avatar: "SR" },
  { id: 2, name: "Mia T.", rating: 5, text: "Always Yours smells like a dream — floral but not overwhelming. My whole bathroom smells like a spa now lol.", product: "Always Yours", avatar: "MT" },
  { id: 3, name: "Zara K.", rating: 5, text: "The Sugar Rush scrub left my skin SO smooth. I use it every other day. Can't believe I slept on this brand!", product: "Sugar Rush", avatar: "ZK" },
  { id: 4, name: "Ava P.", rating: 5, text: "Summer Freshie is perfect for summer. Lasts all day even in the heat. Definitely my new fave!", product: "Summer Freshie", avatar: "AP" },
];

const colorStrips = [
  { color: "#FFB3D1", label: "Always Yours", id: "1" },
  { color: "#E8222E", label: "Summer Freshie", id: "2" },
  { color: "#F97316", label: "Kissing Mizzle", id: "3" },
  { color: "#CCDD00", label: "Rainbow Lemon", id: "4" },
  { color: "#29B8E8", label: "Rocking Fantasy", id: "5" },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail("");
    }
  };

  return (
    <div className="min-h-screen">

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-gray-900">
        {/* Background image */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Dear Body Products"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/60 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6 border border-white/20">
              <Sparkles size={14} className="text-yellow-400" />
              <span className="text-white text-sm font-medium">New Summer Collection 2026</span>
            </div>

            <h1 className="text-white mb-6" style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              Dare to be{" "}
              <span className="bg-gradient-to-r from-pink-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                Vibrant
              </span>
            </h1>

            <p className="text-gray-200 text-lg mb-10 leading-relaxed">
              Discover our bold collection of perfumed body sprays and luxurious skincare. 
              Every scent tells your story — make it unforgettable.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/shop"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 text-white rounded-full font-bold hover:opacity-90 transition-all duration-200 hover:scale-105 shadow-lg shadow-pink-500/30"
              >
                Shop Now <ArrowRight size={18} />
              </Link>
              <Link
                to="/shop?category=Body+Spray"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-full font-bold border border-white/30 hover:bg-white/20 transition-all duration-200"
              >
                View Body Sprays
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-8 mt-12 pt-10 border-t border-white/20">
              {[
                { value: "50K+", label: "Happy Customers" },
                { value: "12", label: "Unique Scents" },
                { value: "4.9★", label: "Average Rating" },
              ].map(stat => (
                <div key={stat.label}>
                  <p className="text-white font-black text-2xl">{stat.value}</p>
                  <p className="text-gray-400 text-xs mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Color strip overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-r from-pink-500 via-red-500 via-orange-500 via-yellow-400 via-lime-500 to-sky-500" />
      </section>

      {/* ─── SCENT RAINBOW SELECTOR ─── */}
      <section className="py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3 justify-center">
            {colorStrips.map(s => (
              <Link
                key={s.id}
                to={`/product/${s.id}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold hover:scale-105 transition-all duration-200 shadow-md"
                style={{ backgroundColor: s.color }}
              >
                <span className="w-2 h-2 rounded-full bg-white/80" />
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section className="py-12 bg-gradient-to-br from-pink-50 to-orange-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Truck, title: "Free Shipping", desc: "On orders over R50", color: "text-pink-500" },
              { icon: RotateCcw, title: "Easy Returns", desc: "30-day return policy", color: "text-red-500" },
              { icon: Shield, title: "Cruelty-Free", desc: "100% vegan & ethical", color: "text-orange-500" },
              { icon: Sparkles, title: "Premium Quality", desc: "Dermatologist tested", color: "text-yellow-500" },
            ].map(f => (
              <div key={f.title} className="flex flex-col items-center text-center p-5 bg-white rounded-2xl shadow-sm">
                <f.icon size={28} className={f.color + " mb-3"} />
                <h4 className="font-bold text-gray-900 mb-1">{f.title}</h4>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BODY SPRAYS SPOTLIGHT ─── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-pink-100 text-pink-600 rounded-full text-sm font-bold mb-4">THE RAINBOW COLLECTION</span>
            <h2 className="text-gray-900 mb-4" style={{ fontSize: "2.5rem", fontWeight: 900 }}>
              Find Your{" "}
              <span className="bg-gradient-to-r from-pink-500 via-orange-500 to-yellow-500 bg-clip-text text-transparent">
                Signature Scent
              </span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Five vibrant fragrances, each inspired by a different color of confidence. Which one is you?
            </p>
          </div>

          {/* Color-coded spray cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
            {sprayProducts.map(product => (
              <Link
                key={product.id}
                to={`/product/${product.id}`}
                className="group relative rounded-2xl overflow-hidden aspect-[3/4] hover:scale-105 transition-all duration-300 shadow-md hover:shadow-xl"
                style={{ backgroundColor: product.color }}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:opacity-60 transition-opacity"
                />
                <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/50 to-transparent">
                  <p className="text-white text-xs opacity-80 mb-0.5">my</p>
                  <p className="text-white font-black text-lg leading-tight uppercase">DEAR BODY</p>
                  <p className="text-white/90 text-xs italic mt-1">{product.tagline.split(" ")[0].toLowerCase()}</p>
                  <p className="text-white font-bold mt-2">R{product.price.toFixed(2)}</p>
                </div>
                {product.badge && (
                  <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full">
                    {product.badge}
                  </div>
                )}
              </Link>
            ))}
          </div>

          <div className="text-center">
            <Link
              to="/shop?category=Body+Spray"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold hover:opacity-90 transition-opacity"
            >
              Shop All Body Sprays <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FEATURED PRODUCTS ─── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <div>
              <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">CUSTOMER FAVORITES</span>
              <h2 className="text-gray-900" style={{ fontSize: "2.2rem", fontWeight: 900 }}>Bestselling Products</h2>
            </div>
            <Link to="/shop" className="inline-flex items-center gap-1 text-pink-500 font-bold hover:text-pink-600 transition-colors">
              View All <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── BANNER ─── */}
      <section className="py-20 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 relative overflow-hidden">
        {/* Decorative shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-white/10 translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="mb-4" style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 900 }}>
            🌟 The Summer Bundle — Save 30%
          </h2>
          <p className="text-white/90 text-lg mb-8 max-w-2xl mx-auto">
            Get all 5 Rainbow body sprays in one stunning set. Limited edition summer packaging included!
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-10 py-4 bg-white text-pink-600 rounded-full font-black text-lg hover:scale-105 transition-all duration-200 shadow-xl"
          >
            Grab the Bundle <ArrowRight size={20} />
          </Link>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-yellow-100 text-yellow-600 rounded-full text-sm font-bold mb-4">REVIEWS</span>
            <h2 className="text-gray-900" style={{ fontSize: "2.2rem", fontWeight: 900 }}>
              They're Obsessed 💕
            </h2>
            <div className="flex items-center justify-center gap-1 mt-3">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={20} className="text-yellow-400 fill-yellow-400" />
              ))}
              <span className="text-gray-600 ml-2">4.9 out of 5 (2,000+ reviews)</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {testimonials.map(t => (
              <div key={t.id} className="bg-gray-50 rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-0.5 mb-4">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} size={14} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-gray-400 text-xs">{t.product}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── NEWSLETTER ─── */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-pink-500" />
          <div className="absolute bottom-10 right-20 w-56 h-56 rounded-full bg-orange-500" />
          <div className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full bg-yellow-400" />
        </div>

        <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-white mb-4" style={{ fontSize: "2.2rem", fontWeight: 900 }}>
            Stay in the Know 💌
          </h2>
          <p className="text-gray-300 mb-8">
            Be the first to hear about new scents, exclusive drops, and deals curated just for you. 
            Join 50,000+ fragrance lovers!
          </p>
          {subscribed ? (
            <div className="bg-green-500/20 border border-green-500/30 rounded-2xl px-8 py-5 text-green-400 font-bold text-lg">
              🎉 You're in! Check your inbox for a welcome gift.
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                className="flex-1 px-5 py-4 rounded-full bg-white/10 text-white placeholder-gray-400 border border-white/20 focus:outline-none focus:border-pink-400 backdrop-blur-sm"
              />
              <button
                type="submit"
                className="px-8 py-4 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Subscribe 🌈
              </button>
            </form>
          )}
          <p className="text-gray-500 text-xs mt-4">No spam, ever. Unsubscribe at any time.</p>
        </div>
      </section>
    </div>
  );
}