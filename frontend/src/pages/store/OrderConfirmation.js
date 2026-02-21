import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Package, ArrowRight, Mail } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { useStore } from '../../context/StoreContext';

export default function OrderConfirmation() {
  const { currentOrder } = useStore();

  const order = currentOrder || {
    id: 'ORD-DEMO-001',
    items: [],
    total: 0,
    date: new Date().toISOString(),
    status: 'confirmed',
    shipping: 'Standard Delivery',
    payment: 'card',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
          <Check className="w-8 h-8 text-success" />
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl mb-3">Thank You!</h1>
        <p className="font-body text-muted-foreground">Your order has been confirmed</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-lg border border-border p-6 sm:p-8 mb-8"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-body uppercase tracking-wider text-muted-foreground">Order Number</p>
            <p className="font-heading text-lg">{order.id}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-body uppercase tracking-wider text-muted-foreground">Date</p>
            <p className="font-body text-sm">{new Date(order.date).toLocaleDateString()}</p>
          </div>
        </div>

        <Separator className="mb-6" />

        {order.items.length > 0 && (
          <div className="space-y-3 mb-6">
            {order.items.map(item => (
              <div key={item.id} className="flex items-center gap-4">
                <div className="w-14 h-16 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground font-body">Qty: {item.quantity}</p>
                </div>
                <span className="font-body text-sm">R{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <Separator />
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground mb-1">Shipping</p>
            <p className="font-body">{order.shipping}</p>
          </div>
          <div>
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground mb-1">Payment</p>
            <p className="font-body capitalize">{order.payment}</p>
          </div>
          <div className="text-right">
            <p className="font-body text-xs uppercase tracking-wider text-muted-foreground mb-1">Total</p>
            <p className="font-heading text-xl">R{order.total.toFixed(2)}</p>
          </div>
        </div>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-4 mb-10">
        <div className="flex items-center gap-3 p-4 rounded-md bg-secondary/50">
          <Package className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="font-body text-sm font-medium">Shipping Updates</p>
            <p className="text-xs font-body text-muted-foreground">You'll receive tracking info via email</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-4 rounded-md bg-secondary/50">
          <Mail className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="font-body text-sm font-medium">Order Confirmation</p>
            <p className="text-xs font-body text-muted-foreground">A receipt has been sent to your email</p>
          </div>
        </div>
      </div>

      <div className="text-center space-y-3">
        <Button variant="elegant" size="lg" className="rounded-sm" asChild>
          <Link to="/products">Continue Shopping <ArrowRight className="w-4 h-4 ml-1" /></Link>
        </Button>
        <p className="text-xs font-body text-muted-foreground">
          <Link to="/admin/orders" className="text-primary hover:underline">View in Admin Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
