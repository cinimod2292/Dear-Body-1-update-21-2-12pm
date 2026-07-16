import { Product } from "../data/products";

export const SEO_BASE_URL = "https://mydearbody.co.za";
export const PRIMARY_KEYWORDS = ["Fragrances South Africa", "Women's Perfume", "Body Care"];

export type CategorySeoContent = {
  title: string;
  h1: string;
  description: string;
  intro: string;
  buyingGuide: string[];
  faqs: Array<{ question: string; answer: string }>;
  relatedLinks: Array<{ label: string; href: string }>;
};

export const CATEGORY_SEO: Record<string, CategorySeoContent> = {
  "Body Spray": {
    title: "Body Sprays & Everyday Fragrances South Africa",
    h1: "Body Sprays & Everyday Fragrances",
    description: "Shop Dear Body body sprays and everyday fragrances in South Africa. Discover affordable scent layering, fresh mist routines and giftable fragrance favourites.",
    intro: "Find an easy signature scent for work, weekends and gifting. Dear Body body sprays are made for fragrance layering, handbag top-ups and everyday confidence in the South African climate.",
    buyingGuide: [
      "Choose fruity or floral body sprays for daytime freshness and warm gourmand notes for evenings.",
      "Layer a body spray over matching lotion or butter to help the fragrance feel richer and last longer.",
      "Keep one mist at home and one in your bag for quick refreshes after gym, commute or travel.",
    ],
    faqs: [
      { question: "How do I make a body spray last longer?", answer: "Apply moisturiser first, then mist pulse points and clothing from a short distance. Reapply during the day as needed." },
      { question: "Are body sprays good gifts?", answer: "Yes. They are approachable, affordable and easy to pair with lotions, scrubs and body butters for a complete fragrance gift set." },
    ],
    relatedLinks: [
      { label: "Shop body lotions for scent layering", href: "/shop?category=Body%20Lotion" },
      { label: "Explore all fragrance and body care", href: "/shop" },
    ],
  },
  "Body Lotion": {
    title: "Body Lotions South Africa | Fragranced Body Care",
    h1: "Hydrating Fragranced Body Lotions",
    description: "Shop fragranced body lotions in South Africa. Hydrate, soften and layer your favourite Dear Body scents with moisturising body care.",
    intro: "A scented body lotion is the foundation of a longer-lasting fragrance routine. Use it after showering to soften dry skin and create a smooth base for body spray or perfume mist.",
    buyingGuide: [
      "Pick lighter lotions for daytime comfort and richer textures when your skin feels dry.",
      "Apply while skin is slightly damp to lock in moisture and improve fragrance layering.",
      "Pair with a matching or complementary body spray to build a personalised scent wardrobe.",
    ],
    faqs: [
      { question: "Can body lotion improve fragrance longevity?", answer: "Moisturised skin holds scent better than dry skin, so lotion is an important first step in any fragrance routine." },
      { question: "When should I apply body lotion?", answer: "Apply after showering or bathing, then reapply to hands, elbows and dry areas whenever skin needs comfort." },
    ],
    relatedLinks: [
      { label: "Layer with body sprays", href: "/shop?category=Body%20Spray" },
      { label: "Prep skin with body scrubs", href: "/shop?category=Body%20Scrub" },
    ],
  },
  "Body Scrub": {
    title: "Body Scrubs South Africa | Smooth Skin Body Care",
    h1: "Exfoliating Body Scrubs for Smooth Skin",
    description: "Shop Dear Body body scrubs in South Africa. Exfoliate dull skin, prep for moisturiser and improve your body care fragrance routine.",
    intro: "Body scrubs help polish away dullness so lotions, butters and fragrance mists apply more evenly. Add exfoliation to your weekly routine for smoother-feeling skin.",
    buyingGuide: [
      "Use a scrub before lotion or body butter so moisturisers can spread evenly.",
      "Focus on rough areas such as elbows, knees and heels while avoiding irritated skin.",
      "Follow with fragranced body care to leave skin feeling soft, smooth and beautifully scented.",
    ],
    faqs: [
      { question: "How often should I use a body scrub?", answer: "Most routines work well with exfoliation one to three times per week, depending on skin sensitivity." },
      { question: "Should I moisturise after exfoliating?", answer: "Yes. Follow with lotion or body butter to replenish comfort and support a smoother skin feel." },
    ],
    relatedLinks: [
      { label: "Hydrate with body lotions", href: "/shop?category=Body%20Lotion" },
      { label: "Finish with body butter", href: "/shop?category=Body%20Butter" },
    ],
  },
  "Body Butter": {
    title: "Body Butters South Africa | Rich Fragranced Moisture",
    h1: "Rich Fragranced Body Butters",
    description: "Shop rich body butters in South Africa. Nourishing fragranced body care for dry skin, evening routines and scent layering.",
    intro: "Body butter is ideal when skin needs extra comfort and a more indulgent fragrance ritual. Use after showering or before bed for soft-feeling, beautifully scented skin.",
    buyingGuide: [
      "Choose body butter when you want richer moisture than a lightweight lotion.",
      "Apply to dry-prone areas including elbows, knees, feet and shoulders.",
      "Layer with body spray to create a fuller women's perfume-inspired routine at an accessible price.",
    ],
    faqs: [
      { question: "What is body butter best for?", answer: "Body butter is best for richer-feeling moisture, especially on dry-prone areas or as part of an evening self-care ritual." },
      { question: "Can I use body butter with fragrance mist?", answer: "Yes. Body butter creates a moisturised base that helps fragrance mist feel more rounded and longer lasting." },
    ],
    relatedLinks: [
      { label: "Shop everyday fragrances", href: "/shop?category=Body%20Spray" },
      { label: "Browse all body care", href: "/shop" },
    ],
  },
};

export const DEFAULT_SHOP_SEO: CategorySeoContent = {
  title: "Fragrances South Africa | Women's Perfume & Body Care",
  h1: "Fragrances, Women's Perfume & Body Care in South Africa",
  description: "Shop Dear Body for fragrances in South Africa, women's perfume-inspired body sprays, lotions, scrubs and body care delivered nationwide.",
  intro: "Dear Body brings fragrance-led beauty to South Africa with body sprays, lotions, scrubs and body butters designed for layering, gifting and everyday confidence.",
  buyingGuide: [
    "Start with a body scrub to smooth skin, then moisturise with lotion or body butter.",
    "Choose a body spray for everyday scent and reapply when you want a fresh fragrance boost.",
    "Build a routine around one scent family or mix fruity, floral and warm notes to suit the occasion.",
  ],
  faqs: [
    { question: "Does Dear Body deliver across South Africa?", answer: "Yes. Dear Body is built for South African shoppers with nationwide ecommerce delivery options shown at checkout." },
    { question: "What is the best way to layer fragrance and body care?", answer: "Cleanse, exfoliate when needed, moisturise, then apply body spray to pulse points and clothing for a fuller routine." },
    { question: "Are these products suitable for gifting?", answer: "Yes. Body sprays, lotions, scrubs and butters are easy to combine into affordable fragrance and body care gifts." },
  ],
  relatedLinks: [
    { label: "Body sprays", href: "/shop?category=Body%20Spray" },
    { label: "Body lotions", href: "/shop?category=Body%20Lotion" },
    { label: "Body scrubs", href: "/shop?category=Body%20Scrub" },
    { label: "Body butters", href: "/shop?category=Body%20Butter" },
  ],
};

export function getCategorySeo(category?: string | null) {
  return category ? CATEGORY_SEO[category] ?? DEFAULT_SHOP_SEO : DEFAULT_SHOP_SEO;
}

export function buildEnhancedProductDescription(product: Product) {
  const notes = product.scent ? `${product.scent} fragrance notes` : `${product.category.toLowerCase()} scent profile`;
  return product.description || `${product.name} is a Dear Body ${product.category.toLowerCase()} created for fragrance lovers in South Africa. Enjoy ${notes}, easy daily use and a beauty routine that layers beautifully with complementary body care.`;
}

export function productBenefits(product: Product) {
  return [
    `Designed for ${product.category.toLowerCase()} lovers building a fragrance-led body care routine.`,
    product.scent ? `Features a ${product.scent.toLowerCase()} scent direction for easy layering.` : "Pairs well with body sprays, lotions, scrubs and butters from Dear Body.",
    "Suitable for gifting, self-care routines and everyday beauty top-ups.",
  ];
}
