import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Star, Sparkles, Truck, ShieldCheck, Leaf } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import { ProductCard } from '../../components/store/ProductCard';
import { PRODUCTS, CATEGORIES, HERO_IMAGES } from '../../data/mockData';
import { useStore } from '../../context/StoreContext';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1 } }),
};

export default function HomePage() {
  const { addToCart } = useStore();
  const bestSellers = PRODUCTS.filter(p => p.tags?.includes('bestseller')).slice(0, 4);
  const newArrivals = PRODUCTS.filter(p => p.tags?.includes('new')).slice(0, 4);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-gradient-hero">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGES.main}
            alt="Dear Body Collection"
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/70 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-2xl">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
              <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 font-body text-xs tracking-widest uppercase px-3 py-1.5 rounded-sm">New Collection 2024</Badge>
            </motion.div>
            <motion.h1
              initial="hidden" animate="visible" variants={fadeUp} custom={1}
              className="font-heading text-4xl sm:text-5xl lg:text-7xl leading-tight mb-6 text-foreground"
            >
              Where Nature Meets <span className="italic">Radiance</span>
            </motion.h1>
            <motion.p
              initial="hidden" animate="visible" variants={fadeUp} custom={2}
              className="font-body text-base sm:text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed"
            >
              Discover our petal-infused collection crafted with botanical essences. Luxurious body care rituals that transform your everyday routine.
            </motion.p>
            <motion.div
              initial="hidden" animate="visible" variants={fadeUp} custom={3}
              className="flex flex-wrap gap-3"
            >
              <Button size="xl" variant="elegant" className="rounded-sm" asChild>
                <Link to="/products">Shop Collection <ArrowRight className="w-4 h-4 ml-1" /></Link>
              </Button>
              <Button size="xl" variant="beauty" className="rounded-sm" asChild>
                <Link to="/category/gift-sets">Gift Sets</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-card border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {[
              { icon: Truck, label: 'Free Shipping', desc: 'Orders over R50' },
              { icon: ShieldCheck, label: 'Secure Checkout', desc: '100% encrypted' },
              { icon: Leaf, label: 'Natural Ingredients', desc: 'Petal-infused' },
              { icon: Sparkles, label: 'Premium Quality', desc: 'GMP certified' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/8 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-body font-medium text-foreground">{item.label}</p>
                  <p className="text-xs font-body text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
          <p className="text-xs font-body uppercase tracking-[0.2em] text-primary mb-2">Explore</p>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl">Shop by Category</h2>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={i * 0.1}
            >
              <Link to={`/category/${cat.slug}`} className={`group block relative overflow-hidden rounded-lg ${i === 0 ? 'lg:row-span-2' : ''}`}>
                <div className={`aspect-[4/3] ${i === 0 ? 'lg:aspect-auto lg:h-full' : ''}`}>
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-foreground/30 group-hover:bg-foreground/40 transition-colors duration-300" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                    <h3 className="font-heading text-xl sm:text-2xl lg:text-3xl text-background mb-1">{cat.name}</h3>
                    <p className="text-xs font-body text-background/70 hidden sm:block">{cat.count} products</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Best Sellers */}
      <section className="bg-gradient-warm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs font-body uppercase tracking-[0.2em] text-primary mb-2">Most Loved</p>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl">Best Sellers</h2>
            </div>
            <Button variant="ghost" className="hidden sm:flex text-sm" asChild>
              <Link to="/products">View All <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {bestSellers.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Button variant="beauty" asChild><Link to="/products">View All Products</Link></Button>
          </div>
        </div>
      </section>

      {/* Lifestyle Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <div className="rounded-lg overflow-hidden aspect-[4/5]">
              <img src={HERO_IMAGES.lifestyle} alt="Dear Body Lifestyle" className="w-full h-full object-cover" />
            </div>
          </motion.div>
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0.2} className="lg:pl-8">
            <p className="text-xs font-body uppercase tracking-[0.2em] text-primary mb-3">Our Heritage</p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl leading-tight mb-6">
              Born from <span className="italic">Petal Essence</span>
            </h2>
            <p className="font-body text-muted-foreground leading-relaxed mb-6">
              Dear Body originated from a rural English town where locals bathed daily in fragrant flower petals, resulting in remarkably radiant skin. We’ve captured this secret, extracting precious petal essences and blending them with modern botanical science.
            </p>
            <p className="font-body text-muted-foreground leading-relaxed mb-8">
              Each product carries the legacy of natural beauty, enhanced with plant extracts and crafted in our GMP-certified laboratory. From our family to yours — a gift of nature’s finest.
            </p>
            <div className="grid grid-cols-3 gap-6 mb-8">
              {[
                { number: '90+', label: 'Countries' },
                { number: '200+', label: 'Brand Stores' },
                { number: '50+', label: 'Patents' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="font-heading text-3xl text-primary">{stat.number}</p>
                  <p className="text-xs font-body text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
            <Button variant="elegant" className="rounded-sm" asChild>
              <Link to="/products">Discover More <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* New Arrivals */}
      <section className="bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs font-body uppercase tracking-[0.2em] text-primary mb-2">Just Arrived</p>
              <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl">New Arrivals</h2>
            </div>
            <Button variant="ghost" className="hidden sm:flex text-sm" asChild>
              <Link to="/products">View All <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {newArrivals.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center mb-12">
          <p className="text-xs font-body uppercase tracking-[0.2em] text-primary mb-2">Reviews</p>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl">Loved by Thousands</h2>
        </motion.div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { name: 'Sarah J.', text: 'The Petal Essence Body Oil is absolutely divine. My skin has never felt so luxurious and the scent lasts all day.', rating: 5, product: 'Petal Essence Body Oil' },
            { name: 'Emily C.', text: 'I bought the Cherry Blossom Gift Set for my mum and she was over the moon! Beautiful packaging and even better products.', rating: 5, product: 'Cherry Blossom Gift Set' },
            { name: 'Michael T.', text: "Finally found a men's cologne that's sophisticated without being overpowering. The Gentleman's Noir is my new daily wear.", rating: 5, product: "Gentleman's Noir" },
          ].map((review, i) => (
            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i * 0.15}>
              <Card className="h-full flex flex-col border-border/50 shadow-soft">
                <CardContent className="p-6 flex flex-col flex-1">
                  <div className="flex gap-0.5 mb-4">
                    {[...Array(review.rating)].map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="font-body text-sm text-foreground leading-relaxed mb-4 flex-1">"{review.text}"</p>
                  <div className="mt-auto">
                    <Separator className="mb-4" />
                    <p className="font-body text-sm font-medium text-foreground">{review.name}</p>
                    <p className="text-xs font-body text-muted-foreground">Verified Purchase • {review.product}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={HERO_IMAGES.botanical} alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-hero" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl mb-4">Your Beauty Ritual Awaits</h2>
            <p className="font-body text-muted-foreground max-w-md mx-auto mb-8">Join thousands who’ve discovered the transformative power of petal-infused beauty.</p>
            <Button size="xl" variant="elegant" className="rounded-sm" asChild>
              <Link to="/products">Shop Now <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
