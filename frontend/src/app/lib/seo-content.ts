import { Product } from "../data/products";

export const PRIMARY_KEYWORDS = ["Fragrances South Africa", "Perfume South Africa", "Fragrance Mists", "Body Lotion"];

export type CategorySeoContent = {
  title: string;
  h1: string;
  description: string;
  intro: string;
  buyingGuide: string[];
  faqs: Array<{ question: string; answer: string }>;
  relatedLinks: Array<{ label: string; href: string }>;
};

const collectionNames = "Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes, Malibu Lemon Blossom and Wild At Kiss";

export const CATEGORY_SEO: Record<string, CategorySeoContent> = {
  Perfume: {
    title: "Eau de Parfum South Africa | Dear Body Perfumes",
    h1: "Eau de Parfum for Signature Scent Moments",
    description: "Shop Dear Body Eau de Parfum in South Africa, including Wild Kiss, Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes and more.",
    intro: `Discover Dear Body Eau de Parfum in 50ml and 90ml bottles across expressive scent stories including ${collectionNames}. Choose long-wearing perfumes for day-to-night fragrance, gifting and signature-scent wardrobes.`,
    buyingGuide: [
      "Choose Wild Kiss or Wild At Kiss when you want confident, romantic floral-gourmand energy.",
      "Pick Summer Freshes or Malibu Lemon Blossom for bright citrus, sunny freshness and easy daytime wear.",
      "Select Kissing Mizzle, Rocking Fantasy or Always Yours when you want playful, sweet or elegant perfume with matching body-care layering options.",
    ],
    faqs: [
      { question: "Which Dear Body perfumes are available?", answer: "The live range includes Eau de Parfum names such as Wild Kiss, Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes, Malibu Lemon Blossom, Wild At Kiss, Monaco, Margarita, Love In White, Fantastic and Sheer Beauty." },
      { question: "Can I layer Dear Body perfume with other products?", answer: "Yes. Pair an Eau de Parfum with matching body lotion, body cream, hand cream, deodorant or fragrance mist where available for a fuller routine." },
    ],
    relatedLinks: [
      { label: "Shop fragrance mists", href: "/shop?category=Mist" },
      { label: "Layer with body lotions", href: "/shop?category=Body%20Lotion" },
      { label: "Browse all Dear Body products", href: "/shop" },
    ],
  },
  Mist: {
    title: "Fragrance Mists South Africa | 30ml, 75ml & 250ml",
    h1: "Fragrance Mists for Everyday Scent Top-Ups",
    description: "Shop Dear Body fragrance mists in South Africa in 30ml, 75ml and 250ml sizes across Kissing Mizzle, Rocking Fantasy, Always Yours and more.",
    intro: "Dear Body fragrance mists are available in travel-friendly 30ml, handbag-ready 75ml and full-size 250ml options across the site’s signature scent families.",
    buyingGuide: [
      "Choose 30ml fragrance mist for sampling, travel and keeping in a handbag.",
      "Choose 75ml for everyday top-ups at work, school, gym or weekends.",
      "Choose 250ml when you already love a scent such as Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes, Malibu Lemon Blossom or Wild At Kiss.",
    ],
    faqs: [
      { question: "What fragrance mist sizes are listed?", answer: "The live catalogue lists Dear Body fragrance mists in 30ml, 75ml and 250ml sizes for multiple scent families." },
      { question: "How should I use a fragrance mist?", answer: "Mist after moisturising and reapply during the day whenever you want a fresh boost of your chosen Dear Body scent." },
    ],
    relatedLinks: [
      { label: "Shop Eau de Parfum", href: "/shop?category=Perfume" },
      { label: "Shop deodorants", href: "/shop?category=Deodorant" },
      { label: "Shop body creams", href: "/shop?category=Body%20Cream" },
    ],
  },
  Deodorant: {
    title: "Dear Body Deodorants South Africa | 50ml & 250ml",
    h1: "Deodorants in Matching Dear Body Scents",
    description: "Shop Dear Body deodorants and deodorant atomiseurs in South Africa, including Kissing Mizzle, Rocking Fantasy, Always Yours and more.",
    intro: "The Dear Body deodorant range includes 50ml deodorants and 250ml deodorant atomiseurs in the same scent families shoppers can pair with mists, perfumes and body care.",
    buyingGuide: [
      "Choose 50ml deodorants for compact everyday freshness.",
      "Choose 250ml deodorant atomiseurs when you want a longer-lasting at-home size.",
      "Match deodorant with the same mist, perfume, lotion or cream scent for a coordinated fragrance routine.",
    ],
    faqs: [
      { question: "Which deodorant sizes are listed?", answer: "The live range includes compact 50ml deodorants and larger 250ml deodorant atomiseurs." },
      { question: "Do the deodorants match other Dear Body scents?", answer: "Yes. Listed deodorant names include Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes, Malibu Lemon Blossom and Wild At Kiss." },
    ],
    relatedLinks: [
      { label: "Shop matching mists", href: "/shop?category=Mist" },
      { label: "Shop perfumes", href: "/shop?category=Perfume" },
      { label: "Shop hand creams", href: "/shop?category=Hand%20Cream" },
    ],
  },
  "Body Lotion": {
    title: "Dear Body Lotions South Africa | 500ml Scented Body Lotion",
    h1: "500ml Scented Body Lotions for Fragrance Layering",
    description: "Shop Dear Body 500ml body lotions in South Africa across Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes and more.",
    intro: "Dear Body 500ml body lotions are designed for daily hydration and fragrance layering, with lightweight formulas in the site’s matching signature scent families.",
    buyingGuide: [
      "Use body lotion after showering to create a hydrated base for fragrance mist or Eau de Parfum.",
      "Choose the same scent family as your mist or perfume for a coordinated routine.",
      "Pick 500ml body lotion when you want a generous daily-use size for home routines.",
    ],
    faqs: [
      { question: "What body lotion size is listed?", answer: "The current Dear Body body lotion range is listed in 500ml bottles." },
      { question: "Which body lotion scents are available?", answer: "The live range includes Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes, Malibu Lemon Blossom and Wild At Kiss body lotions." },
    ],
    relatedLinks: [
      { label: "Shop body creams", href: "/shop?category=Body%20Cream" },
      { label: "Shop fragrance mists", href: "/shop?category=Mist" },
      { label: "Shop perfumes", href: "/shop?category=Perfume" },
    ],
  },
  "Body Cream": {
    title: "Dear Body Creams South Africa | 226ml Scented Body Cream",
    h1: "226ml Scented Body Creams for Rich Moisture",
    description: "Shop Dear Body 226ml body creams in South Africa for richer moisturising routines in matching Dear Body scent families.",
    intro: "Dear Body 226ml body creams add richer moisturising comfort to the fragrance routine, with Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes, Malibu Lemon Blossom and Wild At Kiss options listed.",
    buyingGuide: [
      "Choose body cream when you want richer-feeling moisture than a lighter lotion.",
      "Apply after showering or before bed, then layer with a matching mist or perfume.",
      "Use on dry-prone areas such as elbows, knees, feet and shoulders for a softer skin feel.",
    ],
    faqs: [
      { question: "What size are Dear Body body creams?", answer: "The live catalogue lists Dear Body body creams in 226ml jars/tubs." },
      { question: "How do body creams fit into fragrance layering?", answer: "Use body cream as a rich moisturising base, then apply a matching fragrance mist or Eau de Parfum for a more complete scent routine." },
    ],
    relatedLinks: [
      { label: "Shop body lotions", href: "/shop?category=Body%20Lotion" },
      { label: "Shop fragrance mists", href: "/shop?category=Mist" },
      { label: "Shop hand creams", href: "/shop?category=Hand%20Cream" },
    ],
  },
  "Hand Cream": {
    title: "Dear Body Hand Creams South Africa | 75ml Scented Hand Cream",
    h1: "75ml Scented Hand Creams for On-the-Go Care",
    description: "Shop Dear Body 75ml hand creams in South Africa across Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes and more.",
    intro: "Dear Body 75ml hand creams make it easy to keep matching scent and moisture close by, with compact tubes across the core Dear Body fragrance families.",
    buyingGuide: [
      "Choose 75ml hand cream for handbag, desk or travel-friendly moisturising.",
      "Match your hand cream to your body lotion, mist or perfume for a consistent scent story.",
      "Use after washing hands to refresh moisture and add a soft layer of fragrance.",
    ],
    faqs: [
      { question: "What hand cream size is listed?", answer: "The current Dear Body hand creams are listed in 75ml tubes." },
      { question: "Which hand cream scents are available?", answer: "The live catalogue lists Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes, Malibu Lemon Blossom and Wild At Kiss hand creams." },
    ],
    relatedLinks: [
      { label: "Shop body lotions", href: "/shop?category=Body%20Lotion" },
      { label: "Shop body creams", href: "/shop?category=Body%20Cream" },
      { label: "Shop deodorants", href: "/shop?category=Deodorant" },
    ],
  },
};

export const DEFAULT_SHOP_SEO: CategorySeoContent = {
  title: "Dear Body South Africa | Perfume, Mists & Scented Body Care",
  h1: "Perfume, Fragrance Mists and Scented Body Care in South Africa",
  description: "Shop Dear Body South Africa for Eau de Parfum, fragrance mists, deodorants, hand creams, body creams and body lotions in matching scent families.",
  intro: `Dear Body’s live collection includes 60 products across perfume, fragrance mist, deodorant, hand cream, body cream and body lotion categories, with matching scent families such as ${collectionNames}.`,
  buyingGuide: [
    "Start with body lotion or body cream when you want scent to sit on moisturised skin.",
    "Use fragrance mist for everyday top-ups, then choose Eau de Parfum when you want a more polished signature scent.",
    "Build a matching routine with deodorant, hand cream, lotion, cream, mist and perfume from the same Dear Body scent family.",
  ],
  faqs: [
    { question: "What products are listed on Dear Body?", answer: "The live store lists Eau de Parfum, fragrance mists, deodorants and deodorant atomiseurs, 75ml hand creams, 226ml body creams and 500ml body lotions." },
    { question: "Which Dear Body scent families can I shop?", answer: "Core listed ranges include Kissing Mizzle, Rocking Fantasy, Always Yours, Summer Freshes, Malibu Lemon Blossom and Wild At Kiss, with additional perfumes such as Wild Kiss, Monaco, Margarita, Love In White, Fantastic and Sheer Beauty." },
    { question: "How do I build a Dear Body fragrance routine?", answer: "Moisturise with body lotion or body cream, add deodorant for freshness, refresh with fragrance mist, and finish with Eau de Parfum for a longer-lasting scent impression." },
  ],
  relatedLinks: [
    { label: "Perfume", href: "/shop?category=Perfume" },
    { label: "Fragrance mists", href: "/shop?category=Mist" },
    { label: "Deodorants", href: "/shop?category=Deodorant" },
    { label: "Body lotions", href: "/shop?category=Body%20Lotion" },
    { label: "Body creams", href: "/shop?category=Body%20Cream" },
    { label: "Hand creams", href: "/shop?category=Hand%20Cream" },
  ],
};

export function getCategorySeo(category?: string | null) {
  return category ? CATEGORY_SEO[category] ?? DEFAULT_SHOP_SEO : DEFAULT_SHOP_SEO;
}

export function buildEnhancedProductDescription(product: Product) {
  const size = product.size ? ` in ${product.size}` : "";
  return product.description || `${product.name} is part of the Dear Body ${product.category.toLowerCase()} range${size}. Pair it with matching Dear Body fragrance mists, perfumes, deodorants, hand creams, body creams or lotions where available to build a coordinated scent routine.`;
}

export function productBenefits(product: Product) {
  const category = product.category.toLowerCase();
  return [
    `Part of the live Dear Body ${category} catalogue for South African shoppers.`,
    product.scent ? `Works within the ${product.scent} scent family for easy routine pairing.` : "Pairs with matching Dear Body scent families where available.",
    "Suitable for gifting, daily fragrance routines and matching body-care layering.",
  ];
}
