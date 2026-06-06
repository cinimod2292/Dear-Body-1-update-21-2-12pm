import { BuilderSectionType } from "./types";

export type SectionPreset = {
  id: string;
  name: string;
  description: string;
  sectionType: BuilderSectionType;
  icon: string;
  defaultProps: Record<string, unknown>;
};

export const SECTION_PRESETS: SectionPreset[] = [
  // ─── Hero Banners ─────────────────────────────────────────────────────────
  {
    id: "hero_centered",
    name: "Hero · Centered",
    description: "Centered headline with stacked CTAs",
    sectionType: "hero_banner",
    icon: "🖼️",
    defaultProps: { title: "Feel good in your skin", subtitle: "Body care essentials made simple.", layout: "centered", tone: "soft", primaryButtonText: "Shop now", primaryButtonHref: "/shop", secondaryButtonText: "Learn more", secondaryButtonHref: "/about" },
  },
  {
    id: "hero_image_left",
    name: "Hero · Image Left",
    description: "Split hero with image emphasis on left",
    sectionType: "hero_banner",
    icon: "🖼️",
    defaultProps: { title: "Dare to be vibrant", subtitle: "Discover our bold collection.", layout: "image_left", tone: "warm", primaryButtonText: "Shop now", primaryButtonHref: "/shop" },
  },
  {
    id: "hero_image_right",
    name: "Hero · Image Right",
    description: "Classic split hero with image right",
    sectionType: "hero_banner",
    icon: "🖼️",
    defaultProps: { title: "Dare to be vibrant", subtitle: "Discover our bold collection.", layout: "image_right", tone: "clean", primaryButtonText: "Shop now", primaryButtonHref: "/shop" },
  },

  // ─── Products ─────────────────────────────────────────────────────────────
  {
    id: "featured_latest",
    name: "Products · Latest",
    description: "Auto-show latest products",
    sectionType: "featured_products",
    icon: "🛍️",
    defaultProps: { title: "Latest products", subtitle: "New arrivals this week", mode: "latest", limit: 8, buttonText: "Shop all", buttonHref: "/shop" },
  },
  {
    id: "featured_collection",
    name: "Products · Featured",
    description: "Show featured product set",
    sectionType: "featured_products",
    icon: "🛍️",
    defaultProps: { title: "Featured picks", subtitle: "Hand-picked bestsellers", mode: "featured", limit: 8, buttonText: "Browse collection", buttonHref: "/shop" },
  },
  {
    id: "featured_manual",
    name: "Products · Manual",
    description: "Select products manually",
    sectionType: "featured_products",
    icon: "🛍️",
    defaultProps: { title: "Curated products", subtitle: "Chosen by your team", mode: "manual", productIds: [], limit: 8, buttonText: "Shop now", buttonHref: "/shop" },
  },

  // ─── Image + Text ─────────────────────────────────────────────────────────
  {
    id: "image_text_left",
    name: "Image + Text · Left",
    description: "Image on left, copy on right",
    sectionType: "image_text",
    icon: "📝",
    defaultProps: { title: "Body care for everyday confidence", body: "Craft your routine.", layout: "image_left", tone: "clean", buttonText: "Learn more", buttonHref: "/about" },
  },
  {
    id: "image_text_right",
    name: "Image + Text · Right",
    description: "Image on right, copy on left",
    sectionType: "image_text",
    icon: "📝",
    defaultProps: { title: "Body care for everyday confidence", body: "Craft your routine.", layout: "image_right", tone: "clean", buttonText: "Learn more", buttonHref: "/about" },
  },

  // ─── Benefits ─────────────────────────────────────────────────────────────
  {
    id: "benefits_3col",
    name: "Benefits · 3 Column",
    description: "Trust icons in three columns",
    sectionType: "benefit_icons",
    icon: "✅",
    defaultProps: { title: "Why shoppers choose Dear Body", columns: "3", items: [{ icon: "sparkles", title: "Premium scents", text: "Layerable fragrances" }, { icon: "heart", title: "Skin-first", text: "Comfort-first care" }, { icon: "truck", title: "Fast shipping", text: "Quick delivery" }] },
  },
  {
    id: "benefits_4col",
    name: "Benefits · 4 Column",
    description: "Expanded benefits in four columns",
    sectionType: "benefit_icons",
    icon: "✅",
    defaultProps: { title: "Why shoppers choose Dear Body", columns: "4", items: [{ icon: "sparkles", title: "Premium scents", text: "Layerable fragrances" }, { icon: "heart", title: "Skin-first", text: "Comfort-first care" }, { icon: "truck", title: "Fast shipping", text: "Quick delivery" }, { icon: "shield", title: "Quality tested", text: "Consistent quality" }] },
  },

  // ─── Promo Banners ────────────────────────────────────────────────────────
  {
    id: "promo_sale",
    name: "Promo · Sale",
    description: "General sale promotion",
    sectionType: "promo_banner",
    icon: "🏷️",
    defaultProps: { text: "Seasonal sale — save 30%", buttonText: "Shop sale", buttonHref: "/shop", tone: "warm" },
  },
  {
    id: "promo_delivery",
    name: "Promo · Free Delivery",
    description: "Shipping-focused promotion",
    sectionType: "promo_banner",
    icon: "🏷️",
    defaultProps: { text: "Free delivery on orders over R500", buttonText: "Start shopping", buttonHref: "/shop", tone: "clean" },
  },
  {
    id: "promo_newsletter",
    name: "Promo · Newsletter",
    description: "Grow your subscriber base",
    sectionType: "promo_banner",
    icon: "🏷️",
    defaultProps: { text: "Get 10% off your first order", buttonText: "Join newsletter", buttonHref: "/contact", tone: "soft" },
  },

  // ─── Rich Text ────────────────────────────────────────────────────────────
  {
    id: "rich_text_standard",
    name: "Rich Text · Standard",
    description: "Content block for policies and info pages",
    sectionType: "rich_text",
    icon: "📄",
    defaultProps: { title: "Our story", content: "Tell your brand story here.", alignment: "left", maxWidth: "standard", tone: "white" },
  },
  {
    id: "rich_text_centered",
    name: "Rich Text · Centered",
    description: "Centered content block",
    sectionType: "rich_text",
    icon: "📄",
    defaultProps: { title: "Our commitment", content: "We believe everyone deserves to feel great in their skin.", alignment: "center", maxWidth: "narrow", tone: "soft" },
  },

  // ─── FAQ Accordion ────────────────────────────────────────────────────────
  {
    id: "faq_standard",
    name: "FAQ Accordion",
    description: "Expandable questions and answers",
    sectionType: "faq_accordion",
    icon: "❓",
    defaultProps: { title: "Frequently Asked Questions", subtitle: "Got questions? We have answers.", items: [{ question: "How long does delivery take?", answer: "We dispatch within 1–2 business days." }, { question: "Can I return a product?", answer: "Yes, we accept returns within 30 days of purchase." }], tone: "white" },
  },

  // ─── Newsletter ───────────────────────────────────────────────────────────
  {
    id: "newsletter_standard",
    name: "Newsletter · Standard",
    description: "Email capture with discount incentive",
    sectionType: "newsletter_signup",
    icon: "✉️",
    defaultProps: { title: "Get 10% off your first order", subtitle: "Join thousands of Dear Body lovers and get exclusive deals.", placeholder: "Your email address", buttonText: "Subscribe", disclaimer: "No spam. Unsubscribe anytime.", tone: "soft" },
  },
  {
    id: "newsletter_bold",
    name: "Newsletter · Bold",
    description: "Dark background email signup",
    sectionType: "newsletter_signup",
    icon: "✉️",
    defaultProps: { title: "Stay in the loop", subtitle: "New arrivals, exclusive deals, beauty tips.", placeholder: "Enter your email", buttonText: "Join Now", tone: "bold" },
  },

  // ─── Testimonials ─────────────────────────────────────────────────────────
  {
    id: "testimonials_standard",
    name: "Testimonials · Grid",
    description: "Customer review grid",
    sectionType: "testimonials",
    icon: "⭐",
    defaultProps: { title: "What our customers say", items: [{ quote: "The body sprays last all day. Absolutely love them!", author: "Sarah M.", role: "Verified Buyer", rating: 5 }, { quote: "My skin feels amazing. Best decision ever.", author: "Lerato K.", role: "Verified Buyer", rating: 5 }, { quote: "Fast delivery and gorgeous packaging.", author: "Thandi N.", role: "Verified Buyer", rating: 5 }], tone: "white" },
  },

  // ─── Trust Badges ─────────────────────────────────────────────────────────
  {
    id: "trust_badges_row",
    name: "Trust Badges · Row",
    description: "Horizontal trust signal strip",
    sectionType: "trust_badges",
    icon: "🔒",
    defaultProps: { title: "Trusted by thousands", items: [{ icon: "lock", label: "Secure Checkout" }, { icon: "credit_card", label: "Safe Payment" }, { icon: "money_back", label: "30-Day Returns" }, { icon: "fast_shipping", label: "Fast Dispatch" }], layout: "row", tone: "white" },
  },
  {
    id: "trust_badges_grid",
    name: "Trust Badges · Grid",
    description: "Grid layout trust signals",
    sectionType: "trust_badges",
    icon: "🔒",
    defaultProps: { title: "Why shop with us", items: [{ icon: "lock", label: "Secure Checkout" }, { icon: "credit_card", label: "Safe Payment" }, { icon: "money_back", label: "30-Day Returns" }, { icon: "fast_shipping", label: "Fast Dispatch" }], layout: "grid", tone: "muted" },
  },

  // ─── Countdown Timer ──────────────────────────────────────────────────────
  {
    id: "countdown_sale",
    name: "Countdown · Sale",
    description: "Flash sale with live countdown",
    sectionType: "countdown_banner",
    icon: "⏱️",
    defaultProps: { headline: "Flash Sale Ends Soon!", subtext: "Save 30% on selected products — limited time only.", endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), buttonText: "Shop the Sale", buttonHref: "/shop", tone: "warm" },
  },
  {
    id: "countdown_launch",
    name: "Countdown · Launch",
    description: "New product launch countdown",
    sectionType: "countdown_banner",
    icon: "⏱️",
    defaultProps: { headline: "Something new is coming...", subtext: "Our next collection drops soon.", endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), buttonText: "Get Notified", buttonHref: "/contact", tone: "bold" },
  },

  // ─── Image Gallery ────────────────────────────────────────────────────────
  {
    id: "gallery_3col",
    name: "Gallery · 3 Column",
    description: "Three-column image grid",
    sectionType: "image_gallery",
    icon: "🖼️",
    defaultProps: { title: "Our Collection", images: [], columns: "3", tone: "white" },
  },
  {
    id: "gallery_4col",
    name: "Gallery · 4 Column",
    description: "Four-column image grid",
    sectionType: "image_gallery",
    icon: "🖼️",
    defaultProps: { title: "Gallery", images: [], columns: "4", tone: "muted" },
  },

  // ─── Video Banner ─────────────────────────────────────────────────────────
  {
    id: "video_banner_standard",
    name: "Video Banner",
    description: "Autoplay background video with CTA",
    sectionType: "video_banner",
    icon: "🎬",
    defaultProps: { title: "Experience Dear Body", subtitle: "Discover what makes us different.", overlayOpacity: "medium", buttonText: "Shop Now", buttonHref: "/shop", tone: "bold" },
  },

  // ─── Icon Features ────────────────────────────────────────────────────────
  {
    id: "icon_features_3col",
    name: "Icon Features · 3 Column",
    description: "Three-column feature highlights",
    sectionType: "icon_features",
    icon: "💡",
    defaultProps: { title: "Why choose Dear Body", subtitle: "Premium body care, made for you.", columns: "3", items: [{ icon: "sparkles", title: "Premium Ingredients", description: "Carefully sourced formulas that nourish." }, { icon: "heart", title: "Made with Love", description: "Every product crafted with care." }, { icon: "zap", title: "Fast Absorption", description: "Lightweight and non-greasy." }], tone: "white" },
  },
  {
    id: "icon_features_2col",
    name: "Icon Features · 2 Column",
    description: "Two-column feature highlights",
    sectionType: "icon_features",
    icon: "💡",
    defaultProps: { title: "Our promise", columns: "2", items: [{ icon: "shield", title: "Quality Guaranteed", description: "Every batch tested for consistency and quality." }, { icon: "leaf", title: "Clean Formulas", description: "No harsh chemicals, just clean beauty." }, { icon: "truck", title: "Fast Delivery", description: "Quick dispatch on all local orders." }, { icon: "award", title: "Award Winning", description: "Recognised for excellence in body care." }], tone: "soft" },
  },

  // ─── Contact CTA ──────────────────────────────────────────────────────────
  {
    id: "contact_cta_dark",
    name: "Contact CTA · Dark",
    description: "Dark background contact section",
    sectionType: "contact_cta",
    icon: "📞",
    defaultProps: { title: "Get in touch", subtitle: "Our team is here to help.", email: "hello@dearbody.co.za", phone: "+27 000 000 0000", buttonText: "Send a Message", buttonHref: "/contact", tone: "dark" },
  },
  {
    id: "contact_cta_soft",
    name: "Contact CTA · Soft",
    description: "Light background contact section",
    sectionType: "contact_cta",
    icon: "📞",
    defaultProps: { title: "We'd love to hear from you", subtitle: "Questions about an order? We're just a message away.", email: "hello@dearbody.co.za", buttonText: "Contact Us", buttonHref: "/contact", tone: "soft" },
  },

  // ─── Announcement Bar ─────────────────────────────────────────────────────
  {
    id: "announcement_pink",
    name: "Announcement · Pink",
    description: "Gradient pink promotional bar",
    sectionType: "announcement_bar",
    icon: "📣",
    defaultProps: { text: "Free delivery on orders over R500 🎉", linkText: "Shop Now", linkHref: "/shop", tone: "pink" },
  },
  {
    id: "announcement_dark",
    name: "Announcement · Dark",
    description: "Dark promotional bar",
    sectionType: "announcement_bar",
    icon: "📣",
    defaultProps: { text: "New collection just dropped — shop now.", linkText: "View Collection", linkHref: "/shop", tone: "dark" },
  },

  // ─── Stats Bar ────────────────────────────────────────────────────────────
  {
    id: "stats_light",
    name: "Stats · Light",
    description: "Achievement numbers on white",
    sectionType: "stats_bar",
    icon: "📊",
    defaultProps: { title: "Trusted by thousands", items: [{ value: "10,000+", label: "Happy customers" }, { value: "4.9 ★", label: "Average rating" }, { value: "48h", label: "Average dispatch" }, { value: "30 days", label: "Free returns" }], tone: "white" },
  },
  {
    id: "stats_dark",
    name: "Stats · Dark",
    description: "Achievement numbers on dark background",
    sectionType: "stats_bar",
    icon: "📊",
    defaultProps: { title: "The numbers speak for themselves", items: [{ value: "10,000+", label: "Happy customers" }, { value: "4.9 ★", label: "Average rating" }, { value: "48h", label: "Average dispatch" }, { value: "30 days", label: "Free returns" }], tone: "dark" },
  },
  {
    id: "stats_pink",
    name: "Stats · Pink",
    description: "Achievement numbers on brand gradient",
    sectionType: "stats_bar",
    icon: "📊",
    defaultProps: { items: [{ value: "10,000+", label: "Happy customers" }, { value: "4.9 ★", label: "Average rating" }, { value: "48h", label: "Average dispatch" }], tone: "pink" },
  },

  // ─── Ingredient Highlights ────────────────────────────────────────────────
  {
    id: "ingredients_standard",
    name: "Ingredients · 6 Key",
    description: "Six key ingredients grid",
    sectionType: "ingredient_highlights",
    icon: "🌿",
    defaultProps: { title: "The ingredients that matter", subtitle: "Every formulation is built on clean, effective actives.", items: [{ icon: "leaf", name: "Aloe Vera", benefit: "Soothes and deeply hydrates skin." }, { icon: "droplets", name: "Hyaluronic Acid", benefit: "Locks in moisture for 24 hours." }, { icon: "sun", name: "Vitamin E", benefit: "Protects against free radical damage." }, { icon: "sparkles", name: "Shea Butter", benefit: "Nourishes and softens all skin types." }, { icon: "flask", name: "Niacinamide", benefit: "Evens tone and minimises pores." }, { icon: "wind", name: "Centella Asiatica", benefit: "Repairs and calms sensitive skin." }], tone: "white" },
  },
  {
    id: "ingredients_soft",
    name: "Ingredients · Soft",
    description: "Soft pink background ingredient showcase",
    sectionType: "ingredient_highlights",
    icon: "🌿",
    defaultProps: { title: "Clean beauty, powerful results", items: [{ icon: "leaf", name: "Aloe Vera", benefit: "Soothes and deeply hydrates skin." }, { icon: "droplets", name: "Hyaluronic Acid", benefit: "Locks in moisture for 24 hours." }, { icon: "sparkles", name: "Shea Butter", benefit: "Nourishes and softens all skin types." }], tone: "soft" },
  },

  // ─── Contact Form ─────────────────────────────────────────────────────────
  {
    id: "contact_form_full",
    name: "Contact Form · Full",
    description: "Name, email, subject and message",
    sectionType: "contact_form",
    icon: "📋",
    defaultProps: { title: "Get in touch", subtitle: "We'd love to hear from you.", showName: true, showSubject: true, submitText: "Send Message", successTitle: "Message sent!", successMessage: "Thanks for reaching out. We'll get back to you soon.", tone: "white" },
  },
  {
    id: "contact_form_simple",
    name: "Contact Form · Simple",
    description: "Email and message only",
    sectionType: "contact_form",
    icon: "📋",
    defaultProps: { title: "Send us a message", subtitle: "Questions? We're here to help.", showName: false, showSubject: false, submitText: "Send", successTitle: "Thanks!", successMessage: "We'll be in touch shortly.", tone: "soft" },
  },

  // ─── Social Links ─────────────────────────────────────────────────────────
  {
    id: "social_links_standard",
    name: "Social Links",
    description: "Follow us on social media",
    sectionType: "social_links",
    icon: "🔗",
    defaultProps: { title: "Follow us", instagram: "", tiktok: "", facebook: "", style: "pills", tone: "white" },
  },

  // ─── Spacer ───────────────────────────────────────────────────────────────
  {
    id: "spacer_medium",
    name: "Spacer · Medium",
    description: "Medium spacing between sections",
    sectionType: "spacer",
    icon: "⬜",
    defaultProps: { height: "md", showDivider: false, tone: "white" },
  },
  {
    id: "spacer_divider",
    name: "Spacer · With Divider",
    description: "Spacing with horizontal rule",
    sectionType: "spacer",
    icon: "⬜",
    defaultProps: { height: "lg", showDivider: true, tone: "white" },
  },
];
