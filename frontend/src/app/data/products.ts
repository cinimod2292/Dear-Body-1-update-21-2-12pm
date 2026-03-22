export interface Product {
  id: string;
  slug?: string;
  backendProductId?: string;
  backendVariantId?: string;
  name: string;
  tagline: string;
  price: number;
  originalPrice?: number;
  category: string;
  color: string;
  bgColor: string;
  textColor: string;
  image: string;
  description: string;
  ingredients: string;
  howToUse: string;
  size: string;
  rating: number;
  reviews: number;
  badge?: string;
  inStock: boolean;
  scent?: string;
}

export const products: Product[] = [
  {
    id: "1",
    name: "Always Yours",
    tagline: "Flirty Pink Blossom",
    price: 18.99,
    originalPrice: 24.99,
    category: "Body Spray",
    color: "#FF69B4",
    bgColor: "#FFF0F8",
    textColor: "#C71585",
    image: "https://images.unsplash.com/photo-1508771400123-e194ad75c0e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaW5rJTIwYm9keSUyMHNwcmF5JTIwcGVyZnVtZSUyMGNvc21ldGljJTIwYm90dGxlfGVufDF8fHx8MTc3MjkwNjI2MXww&ixlib=rb-4.1.0&q=80&w=1080",
    description: "A soft, flirtatious fragrance with notes of pink peony, rose petals, and warm musk. Always Yours wraps you in a delicate floral cloud that lingers all day long.",
    ingredients: "Alcohol Denat., Aqua, Parfum, Benzyl Benzoate, Limonene, Linalool, Citronellol, Geraniol, Benzyl Alcohol",
    howToUse: "Hold 15–20 cm from body. Spray onto pulse points — wrists, neck, and décolleté. Apply after showering for longer-lasting fragrance.",
    size: "250ml / 8.45 fl.oz",
    rating: 4.8,
    reviews: 312,
    badge: "SALE",
    inStock: true,
    scent: "Floral & Musky"
  },
  {
    id: "2",
    name: "Summer Freshie",
    tagline: "Bold Tropical Bloom",
    price: 18.99,
    category: "Body Spray",
    color: "#E8222E",
    bgColor: "#FFF5F5",
    textColor: "#B91C1C",
    image: "https://images.unsplash.com/photo-1759793499854-4044b125b37d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcmFuZ2UlMjBwZXJmdW1lJTIwZnJhZ3JhbmNlJTIwc3ByYXklMjBib3R0bGV8ZW58MXx8fHwxNzcyOTA2MjY2fDA&ixlib=rb-4.1.0&q=80&w=1080",
    description: "An electrifying burst of hibiscus, passion fruit, and island breeze. Summer Freshie is your go-to for bold, carefree summer vibes.",
    ingredients: "Alcohol Denat., Aqua, Parfum, Benzyl Benzoate, Limonene, Linalool, Citronellol, Geraniol",
    howToUse: "Spray generously onto body after showering. Can be spritzed throughout the day for a fresh boost.",
    size: "250ml / 8.45 fl.oz",
    rating: 4.9,
    reviews: 489,
    badge: "BESTSELLER",
    inStock: true,
    scent: "Fruity & Tropical"
  },
  {
    id: "3",
    name: "Kissing Mizzle",
    tagline: "Zesty Orange Escape",
    price: 18.99,
    originalPrice: 22.99,
    category: "Body Spray",
    color: "#F97316",
    bgColor: "#FFF7ED",
    textColor: "#C2410C",
    image: "https://images.unsplash.com/photo-1712636999583-a3f883aa48cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2xvcmZ1bCUyMGJlYXV0eSUyMGNvc21ldGljcyUyMHByb2R1Y3RzJTIwZmxhdCUyMGxheXxlbnwxfHx8fDE3NzI5MDYyNjN8MA&ixlib=rb-4.1.0&q=80&w=1080",
    description: "Citrus-kissed and sun-drenched — Kissing Mizzle blends sweet mandarin, bergamot, and warm amber for a fresh, energetic scent that celebrates every moment.",
    ingredients: "Alcohol Denat., Aqua, Parfum, Limonene, Linalool, Citral, Benzyl Benzoate, Eugenol",
    howToUse: "Apply to clean skin. Spray from 15–20 cm distance. Perfect for warm weather days.",
    size: "250ml / 8.45 fl.oz",
    rating: 4.7,
    reviews: 274,
    badge: "SALE",
    inStock: true,
    scent: "Citrus & Warm"
  },
  {
    id: "4",
    name: "Rainbow Lemon",
    tagline: "Bright Sunshine Zest",
    price: 18.99,
    category: "Body Spray",
    color: "#CCDD00",
    bgColor: "#FAFFF0",
    textColor: "#65A30D",
    image: "https://images.unsplash.com/photo-1768328448018-18c45c0df446?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5ZWxsb3clMjBncmVlbiUyMGJvZHklMjBjYXJlJTIwYmVhdXR5JTIwcHJvZHVjdHxlbnwxfHx8fDE3NzI5MDYyNjZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    description: "Sunshine in a bottle. Rainbow Lemon mixes sparkling lemon verbena, green tea, and dewy jasmine for a cheerful, uplifting scent.",
    ingredients: "Alcohol Denat., Aqua, Parfum, Limonene, Linalool, Citral, Geraniol, Benzyl Benzoate",
    howToUse: "Shake gently. Spray onto body and hair. Reapply as needed for a fresh boost.",
    size: "250ml / 8.45 fl.oz",
    rating: 4.6,
    reviews: 198,
    badge: "NEW",
    inStock: true,
    scent: "Fresh & Green"
  },
  {
    id: "5",
    name: "Rocking Fantasy",
    tagline: "Cool Ocean Dream",
    price: 18.99,
    originalPrice: 21.99,
    category: "Body Spray",
    color: "#29B8E8",
    bgColor: "#F0FAFF",
    textColor: "#0369A1",
    image: "https://images.unsplash.com/photo-1765378153943-0f7fd33b2782?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWF1dHklMjBsaWZlc3R5bGUlMjB3b21hbiUyMHN1bW1lciUyMHRyb3BpY2FsfGVufDF8fHx8MTc3MjkwNjI3MHww&ixlib=rb-4.1.0&q=80&w=1080",
    description: "Dive into the coolest escape with Rocking Fantasy — a breezy fusion of ocean mist, sea salt, and white cedar that carries you away to paradise.",
    ingredients: "Alcohol Denat., Aqua, Parfum, Linalool, Benzyl Benzoate, Limonene, Citronellol, Geraniol",
    howToUse: "Spray liberally onto pulse points. Layer with our Rocking Fantasy body lotion for an all-day scent experience.",
    size: "250ml / 8.45 fl.oz",
    rating: 4.9,
    reviews: 521,
    badge: "SALE",
    inStock: true,
    scent: "Aquatic & Fresh"
  },
  {
    id: "6",
    name: "Glow Goddess",
    tagline: "Radiant Body Lotion",
    price: 22.99,
    category: "Body Lotion",
    color: "#FF69B4",
    bgColor: "#FFF0F8",
    textColor: "#C71585",
    image: "https://images.unsplash.com/photo-1767360963892-3353defd6584?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxza2luY2FyZSUyMG1vaXN0dXJpemVyJTIwY3JlYW0lMjBqYXIlMjBsdXh1cnl8ZW58MXx8fHwxNzcyOTA2MjcwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    description: "Luxuriously rich body lotion infused with shea butter, vitamin E, and rose hip oil. Glow Goddess leaves your skin silky smooth with a subtle golden shimmer.",
    ingredients: "Aqua, Glycerin, Butyrospermum Parkii Butter, Caprylic/Capric Triglyceride, Rosa Canina Fruit Oil, Tocopherol",
    howToUse: "Apply generously to clean, dry skin. Massage in circular motions until fully absorbed. Use daily for best results.",
    size: "300ml / 10.1 fl.oz",
    rating: 4.8,
    reviews: 387,
    badge: "BESTSELLER",
    inStock: true,
    scent: "Rose & Vanilla"
  },
  {
    id: "7",
    name: "Sugar Rush",
    tagline: "Exfoliating Body Scrub",
    price: 26.99,
    category: "Body Scrub",
    color: "#F97316",
    bgColor: "#FFF7ED",
    textColor: "#C2410C",
    image: "https://images.unsplash.com/photo-1695131021220-2f3514baaf9e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib2R5JTIwc2NydWIlMjBleGZvbGlhbnQlMjBjb3NtZXRpYyUyMHBpbmt8ZW58MXx8fHwxNzcyOTA2MjcwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    description: "Sweet & spicy sugar scrub with raw cane sugar, coconut oil, and a hint of orange zest. Buff away dullness and reveal your most luminous skin yet.",
    ingredients: "Sucrose, Cocos Nucifera Oil, Parfum, Citrus Aurantium Dulcis Peel Oil, Tocopherol, Citric Acid",
    howToUse: "Apply to wet skin in the shower. Massage in gentle circular motions for 2–3 minutes. Rinse thoroughly. Use 2–3 times per week.",
    size: "200g / 7 oz",
    rating: 4.7,
    reviews: 215,
    badge: "NEW",
    inStock: true,
    scent: "Citrus & Sweet"
  },
  {
    id: "8",
    name: "Cloud Nine",
    tagline: "Whipped Body Butter",
    price: 28.99,
    originalPrice: 34.99,
    category: "Body Butter",
    color: "#29B8E8",
    bgColor: "#F0FAFF",
    textColor: "#0369A1",
    image: "https://images.unsplash.com/photo-1702312687180-617eeeea9228?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMGFwcGx5aW5nJTIwYm9keSUyMGxvdGlvbiUyMHNraW5jYXJlfGVufDF8fHx8MTc3MjkwNjI2Mnww&ixlib=rb-4.1.0&q=80&w=1080",
    description: "Heavenly whipped shea and mango body butter that melts into skin like a dream. Ultra-nourishing and fast absorbing, leaving skin cloud-soft for 24 hours.",
    ingredients: "Butyrospermum Parkii Butter, Mangifera Indica Seed Butter, Theobroma Cacao Seed Butter, Parfum, Tocopherol",
    howToUse: "Scoop a small amount and warm between palms. Massage into skin until fully absorbed. Best applied post-shower on damp skin.",
    size: "250g / 8.8 oz",
    rating: 4.9,
    reviews: 443,
    badge: "SALE",
    inStock: true,
    scent: "Coconut & Vanilla"
  }
];

export const categories = ["All", "Body Spray", "Body Lotion", "Body Scrub", "Body Butter"];
