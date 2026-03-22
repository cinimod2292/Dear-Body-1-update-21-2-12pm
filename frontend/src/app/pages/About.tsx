import { Link } from "react-router";
import { ArrowRight, Heart, Leaf, Sparkles, Globe } from "lucide-react";
import heroImage from "../../assets/909142a9f8349273030b1d771262f7d833d21920.png";

const values = [
  { icon: Heart, title: "Made with Love", desc: "Every fragrance is crafted with passion and care — from concept to the final spritz.", color: "#FF69B4" },
  { icon: Leaf, title: "Vegan & Cruelty-Free", desc: "We never test on animals. Ever. Our products are 100% vegan and ethically sourced.", color: "#CCDD00" },
  { icon: Sparkles, title: "Premium Ingredients", desc: "Only the finest botanicals, essential oils, and skin-loving ingredients make the cut.", color: "#F97316" },
  { icon: Globe, title: "Sustainably Packaged", desc: "Our packaging is recyclable and we're working toward zero-waste by 2027.", color: "#29B8E8" },
];

const team = [
  { name: "Aria Bloom", role: "Founder & CEO", initials: "AB", color: "#FF69B4" },
  { name: "Carmen Sky", role: "Head of Fragrance", initials: "CS", color: "#F97316" },
  { name: "Zoe Radley", role: "Creative Director", initials: "ZR", color: "#29B8E8" },
  { name: "Mika Chen", role: "Head of Product", initials: "MC", color: "#CCDD00" },
];

export default function About() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-32 bg-gray-900 overflow-hidden">
        <img src={heroImage} alt="Dear Body" className="absolute inset-0 w-full h-full object-cover opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 to-gray-900/50" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <span className="inline-block px-4 py-1.5 bg-white/10 text-white rounded-full text-sm font-bold mb-6 backdrop-blur-sm border border-white/20">
            OUR STORY
          </span>
          <h1 className="text-white mb-6" style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)", fontWeight: 900, lineHeight: 1.1 }}>
            Born to Make You{" "}
            <span className="bg-gradient-to-r from-pink-400 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
              Feel Amazing
            </span>
          </h1>
          <p className="text-gray-200 text-xl max-w-2xl mx-auto">
            Dear Body was born from a single belief: that fragrance is the most personal form of self-expression. 
            We create scents that celebrate you, exactly as you are.
          </p>
        </div>
      </section>

      {/* Rainbow strip */}
      <div className="h-2 bg-gradient-to-r from-pink-500 via-red-500 via-orange-500 via-yellow-400 via-lime-500 to-sky-500" />

      {/* Story */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="inline-block px-4 py-1.5 bg-pink-100 text-pink-600 rounded-full text-sm font-bold mb-6">
                FOUNDED IN 2020
              </span>
              <h2 className="text-gray-900 mb-6" style={{ fontSize: "2.5rem", fontWeight: 900, lineHeight: 1.2 }}>
                From a Kitchen Lab to{" "}
                <span className="bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">
                  50,000+ Customers
                </span>
              </h2>
              <p className="text-gray-600 mb-5 leading-relaxed">
                It all started when founder Aria Bloom couldn't find a body spray that felt truly hers. 
                Too harsh, too synthetic, too boring. So she made her own — in her Miami kitchen, mixing botanicals 
                and essential oils until she found the perfect balance of bold and beautiful.
              </p>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Today, Dear Body is a community of over 50,000 fragrance lovers who believe that smelling 
                amazing should feel joyful, vibrant, and completely unapologetic. Our rainbow collection is more 
                than just scent — it's a mood, a statement, a celebration of color.
              </p>
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-bold hover:opacity-90 transition-opacity"
              >
                Shop the Collection <ArrowRight size={16} />
              </Link>
            </div>
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden aspect-square bg-pink-100">
                    <img src={heroImage} alt="Dear Body" className="w-full h-full object-cover" />
                  </div>
                  <div className="rounded-2xl p-6 bg-gradient-to-br from-pink-500 to-red-500 text-white">
                    <p className="font-black text-3xl">50K+</p>
                    <p className="text-white/80 text-sm mt-1">Happy Customers</p>
                  </div>
                </div>
                <div className="space-y-4 mt-8">
                  <div className="rounded-2xl p-6 bg-gradient-to-br from-orange-400 to-yellow-400 text-white">
                    <p className="font-black text-3xl">12</p>
                    <p className="text-white/80 text-sm mt-1">Unique Scents</p>
                  </div>
                  <div className="rounded-2xl overflow-hidden aspect-square bg-blue-100">
                    <div className="w-full h-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                      <div className="text-center text-white">
                        <p className="font-black text-4xl">4.9</p>
                        <p className="text-white/80 text-sm">★ Rating</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">
              WHAT WE STAND FOR
            </span>
            <h2 className="text-gray-900" style={{ fontSize: "2.5rem", fontWeight: 900 }}>
              Our Values
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map(v => (
              <div key={v.title} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow text-center">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
                  style={{ backgroundColor: v.color + "20" }}
                >
                  <v.icon size={28} style={{ color: v.color }} />
                </div>
                <h4 className="font-black text-gray-900 mb-3">{v.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-600 rounded-full text-sm font-bold mb-4">
              THE TEAM
            </span>
            <h2 className="text-gray-900" style={{ fontSize: "2.5rem", fontWeight: 900 }}>
              Meet the Dreamers
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {team.map(member => (
              <div key={member.name} className="text-center">
                <div
                  className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center text-white font-black text-2xl shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${member.color}, ${member.color}99)` }}
                >
                  {member.initials}
                </div>
                <h4 className="font-black text-gray-900">{member.name}</h4>
                <p className="text-gray-400 text-sm mt-1">{member.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center text-white">
          <h2 style={{ fontSize: "2.5rem", fontWeight: 900 }} className="mb-4">
            Ready to Find Your Scent? 🌈
          </h2>
          <p className="text-white/80 text-lg mb-8">
            Explore our full collection and discover the fragrance that's uniquely, perfectly you.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 px-10 py-4 bg-white text-pink-600 rounded-full font-black text-lg hover:scale-105 transition-all shadow-xl"
          >
            Shop Now <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
}
