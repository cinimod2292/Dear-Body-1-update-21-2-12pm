import { Link } from "react-router";
import { Instagram, Facebook, Twitter, Youtube, Mail, Phone, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import logoImage from "../../assets/2f83d3b5e95347ddf4ffa7687e1ec032dc27ba54.png";
import { fetchCmsBootstrap } from "../lib/cms";
import { API_BASE } from "../lib/api";

const iconMap: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
  youtube: Youtube,
};

// Builder pages live at /:slug (not /pages/:slug). CMS-only pages keep /pages/:slug.
const BUILDER_PAGE_SLUGS = new Set(["about", "contact", "returns", "faq", "delivery", "brand", "sale", "campaign"]);

function pageHref(slug: string) {
  return BUILDER_PAGE_SLUGS.has(slug) ? `/${slug}` : `/pages/${slug}`;
}

const DEFAULT_INFO_LINKS = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy Policy", href: "/pages/privacy-policy" },
  { label: "Returns", href: "/returns" },
  { label: "Shipping", href: "/pages/shipping" },
  { label: "Terms", href: "/pages/terms" },
];

export function Footer() {
  const [logoUrl, setLogoUrl] = useState("");
  const [logo2xUrl, setLogo2xUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("hello@dearbody.co.za");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [copyright, setCopyright] = useState(`© ${new Date().getFullYear()} My Dear Body. All rights reserved.`);
  const [socialLinks, setSocialLinks] = useState<Array<{ platform: string; url: string }>>([]);
  const [infoLinks, setInfoLinks] = useState(DEFAULT_INFO_LINKS);
  const [shopCategories, setShopCategories] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetchCmsBootstrap()
      .then((bootstrap) => {
        setLogoUrl(bootstrap.siteConfig.branding.logoUrl || "");
        setLogo2xUrl(bootstrap.siteConfig.branding.logo2xUrl || "");
        setContactEmail(bootstrap.siteConfig.footer.contactEmail || contactEmail);
        setContactPhone(bootstrap.siteConfig.footer.contactPhone || contactPhone);
        setAddress(bootstrap.siteConfig.footer.address || address);
        setCopyright(bootstrap.siteConfig.footer.copyrightText || copyright);
        const realSocialLinks = bootstrap.siteConfig.footer.socialLinks.filter(
          (s) => s.url && s.url !== "#"
        );
        setSocialLinks(realSocialLinks);
        const publishedPages = bootstrap.staticPages.filter((p) => p.status === "published");
        if (publishedPages.length > 0) {
          setInfoLinks(publishedPages.map((p) => ({ label: p.title, href: pageHref(p.slug) })));
        }
      })
      .catch(() => undefined);

    fetch(`${API_BASE}/store/categories`)
      .then((r) => r.json())
      .then((payload) => { if (Array.isArray(payload?.data)) setShopCategories(payload.data); })
      .catch(() => undefined);
  }, []);

  return (
    <footer className="bg-gray-900 text-white">
      <div className="h-2 bg-gradient-to-r from-pink-500 via-red-500 via-orange-500 via-yellow-400 via-lime-500 to-sky-500" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img
                src={logoUrl || logoImage}
                srcSet={logo2xUrl ? `${logoUrl || logoImage} 1x, ${logo2xUrl} 2x` : undefined}
                alt="Dear Body"
                className="h-10 w-auto object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">Vibrant fragrances and body care crafted for those who dare to be bold.</p>
            {socialLinks.length > 0 && (
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
            )}
          </div>

          <div>
            <h4 className="font-bold mb-5 text-white uppercase tracking-wider text-sm">Shop</h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li><Link to="/shop" className="hover:text-pink-400 transition-colors">All Products</Link></li>
              {shopCategories.map((cat) => (
                <li key={cat.id}>
                  <Link to={`/shop?category=${encodeURIComponent(cat.name)}`} className="hover:text-pink-400 transition-colors">
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-5 text-white uppercase tracking-wider text-sm">Info</h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              {infoLinks.map((item) => (
                <li key={item.href}><Link to={item.href} className="hover:text-pink-400 transition-colors">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-5 text-white uppercase tracking-wider text-sm">Contact</h4>
            <ul className="space-y-4 text-gray-400 text-sm">
              {address && <li className="flex items-start gap-3"><MapPin size={16} className="mt-0.5 text-pink-400 shrink-0" /><span>{address}</span></li>}
              {contactPhone && <li className="flex items-center gap-3"><Phone size={16} className="text-pink-400 shrink-0" /><span>{contactPhone}</span></li>}
              {contactEmail && <li className="flex items-center gap-3"><Mail size={16} className="text-pink-400 shrink-0" /><a href={`mailto:${contactEmail}`} className="hover:text-pink-400 transition-colors">{contactEmail}</a></li>}
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
