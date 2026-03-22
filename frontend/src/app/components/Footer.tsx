import { Link } from "react-router";
import { Instagram, Facebook, Twitter, Youtube, Mail, Phone, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import logoImage from "../../assets/2f83d3b5e95347ddf4ffa7687e1ec032dc27ba54.png";
import { fetchCmsBootstrap } from "../lib/cms";

const iconMap: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  youtube: Youtube,
};

export function Footer() {
  const [logoUrl, setLogoUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("hello@dearbody.com");
  const [contactPhone, setContactPhone] = useState("+1 (800) DEAR-BODY");
  const [address, setAddress] = useState("123 Bloom Avenue, Miami, FL 33101, USA");
  const [copyright, setCopyright] = useState(`© ${new Date().getFullYear()} My Dear Body. All rights reserved.`);
  const [socialLinks, setSocialLinks] = useState<Array<{ platform: string; url: string }>>([
    { platform: "instagram", url: "#" },
    { platform: "facebook", url: "#" },
  ]);

  useEffect(() => {
    fetchCmsBootstrap()
      .then((bootstrap) => {
        setLogoUrl(bootstrap.siteConfig.branding.logoUrl || "");
        setContactEmail(bootstrap.siteConfig.footer.contactEmail || contactEmail);
        setContactPhone(bootstrap.siteConfig.footer.contactPhone || contactPhone);
        setAddress(bootstrap.siteConfig.footer.address || address);
        setCopyright(bootstrap.siteConfig.footer.copyrightText || copyright);
        if (bootstrap.siteConfig.footer.socialLinks.length > 0) {
          setSocialLinks(bootstrap.siteConfig.footer.socialLinks);
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <footer className="bg-gray-900 text-white">
      <div className="h-2 bg-gradient-to-r from-pink-500 via-red-500 via-orange-500 via-yellow-400 via-lime-500 to-sky-500" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={logoUrl || logoImage} alt="Dear Body" className="h-10 w-auto object-contain" style={{ filter: "brightness(0) invert(1)" }} />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">Vibrant fragrances and body care crafted for those who dare to be bold.</p>
            <div className="flex gap-3">
              {socialLinks.map(({ platform, url }) => {
                const Icon = iconMap[platform.toLowerCase()] ?? Instagram;
                return (
                  <a key={platform + url} href={url} aria-label={platform} className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gradient-to-br hover:from-pink-500 hover:to-orange-400 flex items-center justify-center transition-all duration-200">
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
          </div>

          <div>
            <h4 className="font-bold mb-5 text-white uppercase tracking-wider text-sm">Shop</h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              {[
                { label: "All Products", to: "/shop" },
                { label: "Body Sprays", to: "/shop?category=Body+Spray" },
                { label: "Body Lotions", to: "/shop?category=Body+Lotion" },
              ].map(({ label, to }) => (
                <li key={label}><Link to={to} className="hover:text-pink-400 transition-colors">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-5 text-white uppercase tracking-wider text-sm">Info</h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              {[
                { label: "About", href: "/pages/about" },
                { label: "Contact", href: "/pages/contact" },
                { label: "Privacy Policy", href: "/pages/privacy-policy" },
                { label: "Returns", href: "/pages/returns" },
                { label: "Shipping", href: "/pages/shipping" },
                { label: "Terms", href: "/pages/terms" },
              ].map((item) => (
                <li key={item.label}><Link to={item.href} className="hover:text-pink-400 transition-colors">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-5 text-white uppercase tracking-wider text-sm">Contact</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
              <li className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 text-pink-400 shrink-0" /><span>{address}</span></li>
              <li className="flex items-center gap-3"><Phone size={16} className="text-pink-400 shrink-0" /><span>{contactPhone}</span></li>
              <li className="flex items-center gap-3"><Mail size={16} className="text-pink-400 shrink-0" /><a href={`mailto:${contactEmail}`} className="hover:text-pink-400 transition-colors">{contactEmail}</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 text-gray-500 text-sm">
          <p>{copyright}</p>
        </div>
      </div>
    </footer>
  );
}
