import { Link } from "react-router";
import { Instagram, Facebook, Twitter, Youtube, Mail, Phone, MapPin } from "lucide-react";
import logoImage from "figma:asset/2f83d3b5e95347ddf4ffa7687e1ec032dc27ba54.png";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      {/* Rainbow strip */}
      <div className="h-2 bg-gradient-to-r from-pink-500 via-red-500 via-orange-500 via-yellow-400 via-lime-500 to-sky-500" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img
                src={logoImage}
                alt="Dear Body"
                className="h-10 w-auto object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Vibrant fragrances and body care crafted for those who dare to be bold, beautiful, and unapologetically themselves.
            </p>
            <div className="flex gap-3">
              {[
                { Icon: Instagram, label: "Instagram" },
                { Icon: Facebook, label: "Facebook" },
                { Icon: Twitter, label: "Twitter" },
                { Icon: Youtube, label: "YouTube" },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gradient-to-br hover:from-pink-500 hover:to-orange-400 flex items-center justify-center transition-all duration-200"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-bold mb-5 text-white uppercase tracking-wider text-sm">Shop</h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              {[
                { label: "All Products", to: "/shop" },
                { label: "Body Sprays", to: "/shop?category=Body+Spray" },
                { label: "Body Lotions", to: "/shop?category=Body+Lotion" },
                { label: "Body Scrubs", to: "/shop?category=Body+Scrub" },
                { label: "Body Butters", to: "/shop?category=Body+Butter" },
                { label: "Gift Sets", to: "/shop" },
              ].map(({ label, to }) => (
                <li key={label}>
                  <Link to={to} className="hover:text-pink-400 transition-colors">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h4 className="font-bold mb-5 text-white uppercase tracking-wider text-sm">Help</h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              {["FAQ", "Shipping & Returns", "Track Your Order", "Privacy Policy", "Terms of Service", "Contact Us"].map(item => (
                <li key={item}>
                  <a href="#" className="hover:text-pink-400 transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-bold mb-5 text-white uppercase tracking-wider text-sm">Contact</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 text-pink-400 shrink-0" />
                <span>123 Bloom Avenue, Miami, FL 33101, USA</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={16} className="text-pink-400 shrink-0" />
                <span>+1 (800) DEAR-BODY</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={16} className="text-pink-400 shrink-0" />
                <a href="mailto:hello@dearbody.com" className="hover:text-pink-400 transition-colors">hello@dearbody.com</a>
              </li>
            </ul>

            {/* Newsletter mini */}
            <div className="mt-6">
              <p className="text-sm text-gray-400 mb-3">Get scent updates:</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-400"
                />
                <button className="px-4 py-2 bg-gradient-to-r from-pink-500 to-orange-400 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-gray-500 text-sm">
          <p>© 2026 My Dear Body. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>We accept:</span>
            <div className="flex gap-2">
              {["VISA", "MC", "AMEX", "PayPal"].map(card => (
                <span key={card} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">{card}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}