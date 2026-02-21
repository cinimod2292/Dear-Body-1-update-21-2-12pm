import React from 'react';
import { Link } from 'react-router-dom';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Instagram, Facebook, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-foreground text-background">
      {/* Newsletter */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center max-w-xl mx-auto mb-16">
          <h3 className="font-heading text-3xl sm:text-4xl mb-3">Stay in Touch</h3>
          <p className="font-body text-sm text-background/60 mb-6">Subscribe to receive exclusive offers, beauty tips, and early access to new collections.</p>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <Input
              placeholder="Enter your email"
              className="flex-1 h-11 rounded-sm bg-background/10 border-background/20 text-background placeholder:text-background/40 font-body text-sm focus-visible:ring-primary"
            />
            <Button variant="default" className="rounded-sm h-11 px-6">Subscribe</Button>
          </form>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          <div>
            <h4 className="font-heading text-lg mb-4">Shop</h4>
            <nav className="space-y-2.5">
              <Link to="/products" className="block text-sm font-body text-background/60 hover:text-background transition-colors duration-200">All Products</Link>
              <Link to="/category/body-care" className="block text-sm font-body text-background/60 hover:text-background transition-colors duration-200">Body Care</Link>
              <Link to="/category/fragrance" className="block text-sm font-body text-background/60 hover:text-background transition-colors duration-200">Fragrance</Link>
              <Link to="/category/gift-sets" className="block text-sm font-body text-background/60 hover:text-background transition-colors duration-200">Gift Sets</Link>
              <Link to="/category/skincare" className="block text-sm font-body text-background/60 hover:text-background transition-colors duration-200">Skincare</Link>
            </nav>
          </div>
          <div>
            <h4 className="font-heading text-lg mb-4">Help</h4>
            <nav className="space-y-2.5">
              <span className="block text-sm font-body text-background/60">Shipping & Delivery</span>
              <span className="block text-sm font-body text-background/60">Returns & Refunds</span>
              <span className="block text-sm font-body text-background/60">FAQ</span>
              <span className="block text-sm font-body text-background/60">Contact Us</span>
            </nav>
          </div>
          <div>
            <h4 className="font-heading text-lg mb-4">Company</h4>
            <nav className="space-y-2.5">
              <span className="block text-sm font-body text-background/60">Our Story</span>
              <span className="block text-sm font-body text-background/60">Sustainability</span>
              <span className="block text-sm font-body text-background/60">Careers</span>
              <span className="block text-sm font-body text-background/60">Press</span>
            </nav>
          </div>
          <div>
            <h4 className="font-heading text-lg mb-4">Connect</h4>
            <div className="flex items-center gap-3 mb-4">
              <a href="#" className="w-9 h-9 rounded-full border border-background/20 flex items-center justify-center hover:bg-background/10 transition-colors duration-200"><Instagram className="w-4 h-4" /></a>
              <a href="#" className="w-9 h-9 rounded-full border border-background/20 flex items-center justify-center hover:bg-background/10 transition-colors duration-200"><Facebook className="w-4 h-4" /></a>
              <a href="#" className="w-9 h-9 rounded-full border border-background/20 flex items-center justify-center hover:bg-background/10 transition-colors duration-200"><Twitter className="w-4 h-4" /></a>
            </div>
            <p className="text-sm font-body text-background/60">Mon - Fri: 9am - 6pm GMT</p>
            <p className="text-sm font-body text-background/60">hello@dearbody.com</p>
          </div>
        </div>

        <Separator className="my-10 bg-background/10" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="font-heading text-xl tracking-[0.15em]">DEAR BODY</Link>
          <p className="text-xs font-body text-background/40">&copy; 2024 Dear Body. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
