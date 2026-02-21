import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Truck, MapPin, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { MOCK_ORDERS, PRODUCTS } from '../../data/mockData';
import { toast } from 'sonner';

const STATUS_COLORS = {
  delivered: 'bg-success/10 text-success',
  processing: 'bg-warning/10 text-warning',
  shipped: 'bg-primary/10 text-primary',
  pending: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function AdminOrderDetail() {
  const { id } = useParams();
  const order = MOCK_ORDERS.find(o => o.id === id);
  const [status, setStatus] = useState(order?.status || 'pending');

  if (!order) {
    return (
      <div className="text-center py-20">
        <h1 className="font-heading text-2xl mb-4">Order Not Found</h1>
        <Button variant="beauty" asChild><Link to="/admin/orders">Back to Orders</Link></Button>
      </div>
    );
  }

  const handleStatusUpdate = (newStatus) => {
    setStatus(newStatus);
    toast.success(`Order status updated to ${newStatus}`);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link to="/admin/orders"><ArrowLeft className="w-4 h-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="font-heading text-2xl">{order.id}</h1>
          <p className="font-body text-sm text-muted-foreground">{new Date(order.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <Badge className={`${STATUS_COLORS[status]} border-0 font-body text-xs uppercase tracking-wider px-3 py-1`}>{status}</Badge>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Items */}
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><Package className="w-4 h-4" /> Order Items</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.items.map((item, i) => {
                  const product = PRODUCTS.find(p => p.id === item.productId);
                  return (
                    <div key={i} className="flex items-center gap-4">
                      <div className="w-14 h-16 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                        {product && <img src={product.image} alt={product?.name} className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-sm truncate">{product?.name || `Product #${item.productId}`}</p>
                        <p className="text-xs text-muted-foreground font-body">Qty: {item.qty}</p>
                      </div>
                      <span className="font-body text-sm font-medium">R{(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
              <Separator className="my-4" />
              <div className="space-y-2 text-sm font-body">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>R{order.total.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Shipping</span><span>R4.99</span></div>
                <Separator />
                <div className="flex justify-between font-medium"><span>Total</span><span className="font-heading text-lg">R{(order.total + 4.99).toFixed(2)}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Status Update */}
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-lg">Update Status</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Select value={status} onValueChange={handleStatusUpdate}>
                  <SelectTrigger className="w-48 h-9 text-sm font-body"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> Shipping</CardTitle></CardHeader>
            <CardContent>
              <p className="font-body text-sm">{order.customer}</p>
              <p className="font-body text-sm text-muted-foreground">{order.shippingAddress}</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><CreditCard className="w-4 h-4" /> Payment</CardTitle></CardHeader>
            <CardContent>
              <p className="font-body text-sm">Credit Card</p>
              <p className="font-body text-sm text-muted-foreground">Ending in 4242</p>
              <p className="font-body text-sm text-success mt-1">Paid</p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-base flex items-center gap-2"><Truck className="w-4 h-4" /> Customer</CardTitle></CardHeader>
            <CardContent>
              <p className="font-body text-sm">{order.customer}</p>
              <p className="font-body text-sm text-muted-foreground">{order.email}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
