// ========== DEAR BODY - Mock Data with Real Brand Images ==========

export const CATEGORIES = [
  { id: 'body-care', name: 'Body Care', slug: 'body-care', description: 'Nourishing body washes, lotions & creams', image: '/images/categories/body_care.png', count: 24 },
  { id: 'fragrance', name: 'Fine Fragrance', slug: 'fragrance', description: 'Exquisite mists & sprays for every mood', image: '/images/categories/fragrance.png', count: 18 },
  { id: 'mens', name: "Men's Collection", slug: 'mens', description: 'Refined grooming essentials for him', image: '/images/categories/mens.png', count: 12 },
  { id: 'home-fragrance', name: 'Home Fragrance', slug: 'home-fragrance', description: 'Candles & diffusers to elevate your space', image: '/images/categories/home_fragrance.png', count: 9 },
  { id: 'gift-sets', name: 'Gift Sets', slug: 'gift-sets', description: 'Curated sets for every occasion', image: '/images/lifestyle/scene_1.jpg', count: 8 },
  { id: 'skincare', name: 'Skincare', slug: 'skincare', description: 'Botanical-infused skincare rituals', image: '/images/lifestyle/scene_2.jpg', count: 15 },
];

export const PRODUCTS = [
  {
    id: 1, name: 'Rocking Fantasy Body Mist', slug: 'rocking-fantasy-body-mist',
    price: 24.99, originalPrice: 29.99, category: 'fragrance', tags: ['bestseller', 'new'],
    image: '/images/products/rocking_fantasy.jpg',
    images: ['/images/products/rocking_fantasy.jpg', '/images/lifestyle/scene_1.jpg'],
    description: 'A captivating blend of exotic fruits and delicate florals that dances on your skin like a fantasy come to life. This enchanting body mist combines notes of passion fruit, jasmine, and vanilla to create an irresistible aura.',
    notes: { top: 'Passion Fruit, Bergamot', middle: 'Jasmine, Peony', base: 'Vanilla, Musk' },
    rating: 4.8, reviews: 156, stock: 45, volume: '250ml',
    ingredients: 'Aqua, Alcohol Denat., Parfum, Glycerin, PEG-40 Hydrogenated Castor Oil'
  },
  {
    id: 2, name: 'Wild at Kiss Shower Gel', slug: 'wild-at-kiss-shower-gel',
    price: 18.99, originalPrice: null, category: 'body-care', tags: ['bestseller'],
    image: '/images/products/wild_at_kiss.png',
    images: ['/images/products/wild_at_kiss.png', '/images/lifestyle/scene_3.jpg'],
    description: 'Indulge in a luxurious shower experience with our Wild at Kiss Shower Gel. Infused with rose petal essence and nourishing botanical extracts, this gel creates a rich lather that cleanses while leaving your skin soft and delicately scented.',
    notes: { top: 'Pink Rose', middle: 'White Lily', base: 'Sandalwood' },
    rating: 4.6, reviews: 89, stock: 62, volume: '300ml',
    ingredients: 'Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Parfum, Glycerin'
  },
  {
    id: 3, name: 'Always Yours Body Lotion', slug: 'always-yours-body-lotion',
    price: 22.50, originalPrice: 27.00, category: 'body-care', tags: ['sale'],
    image: '/images/products/always_yours.jpg',
    images: ['/images/products/always_yours.jpg', '/images/lifestyle/scene_4.jpg'],
    description: 'Wrap yourself in silky-smooth moisture with Always Yours Body Lotion. Enhanced with shea butter and vitamin E, this lightweight formula absorbs quickly, leaving skin hydrated and gloriously scented for hours.',
    notes: { top: 'Peach Blossom', middle: 'Tuberose', base: 'Amber' },
    rating: 4.9, reviews: 203, stock: 38, volume: '250ml',
    ingredients: 'Aqua, Glycerin, Cetearyl Alcohol, Butyrospermum Parkii Butter, Parfum'
  },
  {
    id: 4, name: 'Malibu Lemon Blossom Mist', slug: 'malibu-lemon-blossom-mist',
    price: 26.99, originalPrice: null, category: 'fragrance', tags: ['new'],
    image: '/images/products/malibu_lemon.png',
    images: ['/images/products/malibu_lemon.png', '/images/lifestyle/scene_5.jpg'],
    description: 'Transport yourself to sun-kissed Malibu with this vibrant citrus and floral mist. Fresh lemon zest meets delicate blossom petals for an uplifting, energizing fragrance perfect for daytime wear.',
    notes: { top: 'Lemon Zest, Grapefruit', middle: 'Orange Blossom, Neroli', base: 'White Tea, Cedar' },
    rating: 4.7, reviews: 112, stock: 28, volume: '250ml',
    ingredients: 'Aqua, Alcohol Denat., Parfum, Glycerin, PEG-40 Hydrogenated Castor Oil'
  },
  {
    id: 5, name: 'Sweet Sparkling Fragrance Mist', slug: 'sweet-sparkling-fragrance-mist',
    price: 24.99, originalPrice: null, category: 'fragrance', tags: ['new'],
    image: '/images/products/sweet_sparkling.png',
    images: ['/images/products/sweet_sparkling.png', '/images/lifestyle/scene_6.jpg'],
    description: 'Let your spirit sparkle with this effervescent fragrance mist. Notes of sparkling citrus, wild berries, and soft musk create a joyful, radiant scent that lifts your mood and brightens your day.',
    notes: { top: 'Sparkling Citrus, Wild Berry', middle: 'Jasmine, Lily of the Valley', base: 'Soft Musk, Amber' },
    rating: 4.5, reviews: 67, stock: 80, volume: '250ml',
    ingredients: 'Aqua, Alcohol Denat., Parfum, Glycerin, PEG-40 Hydrogenated Castor Oil'
  },
  {
    id: 6, name: 'Crazy in Shoes Body Cream', slug: 'crazy-in-shoes-body-cream',
    price: 19.99, originalPrice: 24.99, category: 'body-care', tags: ['bestseller', 'sale'],
    image: '/images/products/crazy_in_shoes_cream.png',
    images: ['/images/products/crazy_in_shoes_cream.png', '/images/products/crazy_in_shoes_mist.png'],
    description: 'A luxuriously rich body cream that envelops your skin in moisture and fragrance. Infused with shea butter and vitamin E, this cream melts into skin for long-lasting hydration and a beautifully smooth finish.',
    notes: { top: 'Pink Pepper, Bergamot', middle: 'Rose, Peony', base: 'Cedarwood, Musk' },
    rating: 4.8, reviews: 94, stock: 22, volume: '200ml',
    ingredients: 'Aqua, Glycerin, Butyrospermum Parkii Butter, Cetearyl Alcohol, Parfum'
  },
  {
    id: 7, name: 'Palm Amorous Body Cream', slug: 'palm-amorous-body-cream',
    price: 19.99, originalPrice: null, category: 'body-care', tags: [],
    image: '/images/products/palm_amorous_cream.png',
    images: ['/images/products/palm_amorous_cream.png', '/images/products/palm_amorous_mist.png'],
    description: 'Embrace the warmth of tropical paradise with Palm Amorous Body Cream. Enriched with coconut oil and exotic floral extracts, this indulgent cream nourishes deeply while wrapping you in an intoxicating scent.',
    notes: { top: 'Coconut, Tropical Fruits', middle: 'Frangipani, Orchid', base: 'Vanilla, Sandalwood' },
    rating: 4.9, reviews: 178, stock: 35, volume: '200ml',
    ingredients: 'Aqua, Cocos Nucifera Oil, Glycerin, Cetearyl Alcohol, Parfum'
  },
  {
    id: 8, name: 'Dancing Elves Fragrance Mist', slug: 'dancing-elves-fragrance-mist',
    price: 24.99, originalPrice: null, category: 'fragrance', tags: ['bestseller'],
    image: '/images/products/dancing_elves_mist.png',
    images: ['/images/products/dancing_elves_mist.png', '/images/products/dancing_elves_cream.png'],
    description: 'A whimsical and enchanting fragrance that captures the magic of a moonlit garden. Delicate floral notes dance with fruity accords and a warm woody base to create a truly spellbinding scent experience.',
    rating: 4.7, reviews: 134, stock: 19, volume: '250ml',
    ingredients: 'Aqua, Alcohol Denat., Parfum, Glycerin, PEG-40 Hydrogenated Castor Oil'
  },
  {
    id: 9, name: 'Warm Sunset Body Cream', slug: 'warm-sunset-body-cream',
    price: 19.99, originalPrice: 24.99, category: 'body-care', tags: ['sale', 'bestseller'],
    image: '/images/products/warm_sunset_cream.png',
    images: ['/images/products/warm_sunset_cream.png', '/images/products/warm_sunset_mist.png'],
    description: 'Capture the golden glow of a warm sunset in this luxurious body cream. Rich amber and vanilla notes blend with warm spices and soft florals for a cocooning scent that lingers beautifully on skin.',
    rating: 4.9, reviews: 246, stock: 15, volume: '200ml',
    ingredients: 'Aqua, Glycerin, Butyrospermum Parkii Butter, Cetearyl Alcohol, Parfum'
  },
  {
    id: 10, name: 'Warm Sunset Fragrance Mist', slug: 'warm-sunset-fragrance-mist',
    price: 24.99, originalPrice: null, category: 'fragrance', tags: ['new'],
    image: '/images/products/warm_sunset_mist.png',
    images: ['/images/products/warm_sunset_mist.png', '/images/lifestyle/scene_1.jpg'],
    description: 'The signature Warm Sunset scent in a refreshing mist format. Spritz on for an instant mood lift — golden amber, warm vanilla, and a hint of spice create a radiant, inviting aura throughout the day.',
    rating: 4.6, reviews: 88, stock: 40, volume: '250ml',
    ingredients: 'Aqua, Alcohol Denat., Parfum, Glycerin, PEG-40 Hydrogenated Castor Oil'
  },
  {
    id: 11, name: 'Crazy in Shoes Fragrance Mist', slug: 'crazy-in-shoes-fragrance-mist',
    price: 24.99, originalPrice: null, category: 'fragrance', tags: [],
    image: '/images/products/crazy_in_shoes_mist.png',
    images: ['/images/products/crazy_in_shoes_mist.png', '/images/lifestyle/scene_3.jpg'],
    description: 'An bold and vivacious fragrance mist that captures the thrill of a spontaneous adventure. Sparkling top notes give way to a heart of fresh florals, grounded by a warm, sensual base.',
    rating: 4.4, reviews: 56, stock: 70, volume: '250ml',
    ingredients: 'Aqua, Alcohol Denat., Parfum, Glycerin, PEG-40 Hydrogenated Castor Oil'
  },
  {
    id: 12, name: 'Dancing Elves Body Cream', slug: 'dancing-elves-body-cream',
    price: 19.99, originalPrice: 24.99, category: 'body-care', tags: ['sale'],
    image: '/images/products/dancing_elves_cream.png',
    images: ['/images/products/dancing_elves_cream.png', '/images/lifestyle/scene_6.jpg'],
    description: 'The enchanting Dancing Elves scent in a nourishing body cream. This rich formula melts into skin, leaving it soft, smooth, and delicately perfumed with whimsical floral and woody notes.',
    rating: 4.8, reviews: 143, stock: 25, volume: '200ml',
    ingredients: 'Aqua, Glycerin, Butyrospermum Parkii Butter, Cetearyl Alcohol, Parfum'
  },
];

export const MOCK_ORDERS = [
  { id: 'ORD-2024-001', customer: 'Sarah Johnson', email: 'sarah@email.com', date: '2024-12-15', status: 'delivered', total: 89.97, items: [{productId: 1, qty: 2, price: 24.99}, {productId: 5, qty: 1, price: 24.99}], shippingAddress: '123 Rose Lane, London, UK' },
  { id: 'ORD-2024-002', customer: 'Emily Chen', email: 'emily@email.com', date: '2024-12-18', status: 'processing', total: 19.99, items: [{productId: 9, qty: 1, price: 19.99}], shippingAddress: '456 Bloom St, Manchester, UK' },
  { id: 'ORD-2024-003', customer: 'Michael Torres', email: 'michael@email.com', date: '2024-12-20', status: 'shipped', total: 44.98, items: [{productId: 6, qty: 1, price: 19.99}, {productId: 11, qty: 1, price: 24.99}], shippingAddress: '789 Oak Ave, Birmingham, UK' },
  { id: 'ORD-2024-004', customer: 'Lisa Park', email: 'lisa@email.com', date: '2024-12-22', status: 'pending', total: 49.98, items: [{productId: 8, qty: 1, price: 24.99}, {productId: 10, qty: 1, price: 24.99}], shippingAddress: '321 Garden Rd, Leeds, UK' },
  { id: 'ORD-2024-005', customer: 'James Wilson', email: 'james@email.com', date: '2024-12-24', status: 'delivered', total: 19.99, items: [{productId: 7, qty: 1, price: 19.99}], shippingAddress: '654 Candle Way, Bristol, UK' },
  { id: 'ORD-2024-006', customer: 'Anna Martinez', email: 'anna@email.com', date: '2024-12-26', status: 'processing', total: 67.48, items: [{productId: 2, qty: 1, price: 18.99}, {productId: 3, qty: 1, price: 22.50}, {productId: 4, qty: 1, price: 26.99}], shippingAddress: '987 Petal Dr, Edinburgh, UK' },
  { id: 'ORD-2024-007', customer: 'David Kim', email: 'david@email.com', date: '2024-12-28', status: 'cancelled', total: 19.99, items: [{productId: 6, qty: 1, price: 19.99}], shippingAddress: '147 Cedar Ln, Glasgow, UK' },
  { id: 'ORD-2024-008', customer: 'Olivia Brown', email: 'olivia@email.com', date: '2024-12-30', status: 'pending', total: 39.98, items: [{productId: 9, qty: 2, price: 19.99}], shippingAddress: '258 Flower St, Cardiff, UK' },
];

export const MOCK_CUSTOMERS = [
  { id: 1, name: 'Sarah Johnson', email: 'sarah@email.com', phone: '+44 7700 900123', orders: 8, totalSpent: 342.50, joined: '2024-03-15', avatar: null, address: '123 Rose Lane, London, UK' },
  { id: 2, name: 'Emily Chen', email: 'emily@email.com', phone: '+44 7700 900456', orders: 5, totalSpent: 218.75, joined: '2024-05-22', avatar: null, address: '456 Bloom St, Manchester, UK' },
  { id: 3, name: 'Michael Torres', email: 'michael@email.com', phone: '+44 7700 900789', orders: 12, totalSpent: 567.30, joined: '2024-01-10', avatar: null, address: '789 Oak Ave, Birmingham, UK' },
  { id: 4, name: 'Lisa Park', email: 'lisa@email.com', phone: '+44 7700 900321', orders: 3, totalSpent: 156.00, joined: '2024-08-05', avatar: null, address: '321 Garden Rd, Leeds, UK' },
  { id: 5, name: 'James Wilson', email: 'james@email.com', phone: '+44 7700 900654', orders: 7, totalSpent: 289.90, joined: '2024-02-28', avatar: null, address: '654 Candle Way, Bristol, UK' },
  { id: 6, name: 'Anna Martinez', email: 'anna@email.com', phone: '+44 7700 900987', orders: 15, totalSpent: 780.25, joined: '2023-11-12', avatar: null, address: '987 Petal Dr, Edinburgh, UK' },
];

export const MOCK_REFUNDS = [
  { id: 'REF-001', orderId: 'ORD-2024-007', customer: 'David Kim', reason: 'Changed mind', amount: 19.99, status: 'approved', date: '2024-12-29' },
  { id: 'REF-002', orderId: 'ORD-2024-001', customer: 'Sarah Johnson', reason: 'Product damaged during shipping', amount: 24.99, status: 'pending', date: '2024-12-20' },
  { id: 'REF-003', orderId: 'ORD-2024-003', customer: 'Michael Torres', reason: 'Wrong item received', amount: 24.99, status: 'processing', date: '2024-12-25' },
];

export const SHIPPING_RATES = [
  { id: 1, name: 'Standard Delivery', description: '5-7 business days', price: 4.99, freeAbove: 50 },
  { id: 2, name: 'Express Delivery', description: '2-3 business days', price: 9.99, freeAbove: 100 },
  { id: 3, name: 'Next Day Delivery', description: '1 business day', price: 14.99, freeAbove: null },
  { id: 4, name: 'International Standard', description: '10-15 business days', price: 19.99, freeAbove: 150 },
];

export const SALES_DATA = [
  { month: 'Jul', revenue: 12400, orders: 156 },
  { month: 'Aug', revenue: 15200, orders: 189 },
  { month: 'Sep', revenue: 13800, orders: 172 },
  { month: 'Oct', revenue: 18600, orders: 234 },
  { month: 'Nov', revenue: 24500, orders: 312 },
  { month: 'Dec', revenue: 32100, orders: 398 },
];

export const HERO_IMAGES = {
  main: '/images/hero/index_banner.png',
  productsBanner: '/images/hero/products_banner.png',
  lifestyle: '/images/lifestyle/video_thumb.jpg',
  about: '/images/lifestyle/about.png',
  botanical: '/images/lifestyle/stats_bg.jpg',
  scene1: '/images/lifestyle/scene_1.jpg',
  scene2: '/images/lifestyle/scene_2.jpg',
};
