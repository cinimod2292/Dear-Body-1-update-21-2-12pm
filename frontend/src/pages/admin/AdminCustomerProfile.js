import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail, Phone, MapPin, ShoppingCart, DollarSign, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { MOCK_CUSTOMERS, MOCK_ORDERS } from '../../data/mockData';

const STATUS_COLORS = {
  delivered: 'bg-success/10 text-success',
  processing: 'bg-warning/10 text-warning',
  shipped: 'bg-primary/10 text-primary',
  pending: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function AdminCustomerProfile() {
  const { id } = useParams();
  const customer = MOCK_CUSTOMERS.find(c => c.id === parseInt(id));

  if (!customer) {
    return (
      <div className="text-center py-20">
        <h1 className="font-heading text-2xl mb-4">Customer Not Found</h1>
        <Button variant="beauty" asChild><Link to="/admin/customers">Back to Customers</Link></Button>
      </div>
    );
  }

  const customerOrders = MOCK_ORDERS.filter(o => o.email === customer.email);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link to="/admin/customers"><ArrowLeft className="w-4 h-4" /></Link></Button>
        <h1 className="font-heading text-2xl">Customer Profile</h1>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile */}
        <Card className="shadow-soft">
          <CardContent className="p-6 text-center">
            <Avatar className="w-16 h-16 mx-auto mb-4">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-heading">
                {customer.name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <h2 className="font-heading text-xl mb-1">{customer.name}</h2>
            <p className="font-body text-sm text-muted-foreground mb-4">Member since {new Date(customer.joined).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</p>
            <Separator className="my-4" />
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="font-body text-sm">{customer.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="font-body text-sm">{customer.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="font-body text-sm">{customer.address}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats & Orders */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: ShoppingCart, label: 'Total Orders', value: customer.orders },
              { icon: DollarSign, label: 'Total Spent', value: `R${customer.totalSpent.toFixed(2)}` },
              { icon: Calendar, label: 'Avg. Order', value: `R${(customer.totalSpent / customer.orders).toFixed(2)}` },
            ].map((stat) => (
              <Card key={stat.label} className="shadow-soft">
                <CardContent className="p-4 text-center">
                  <stat.icon className="w-4 h-4 mx-auto mb-2 text-primary" />
                  <p className="font-heading text-lg">{stat.value}</p>
                  <p className="text-xs font-body text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order History */}
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-lg">Order History</CardTitle></CardHeader>
            <CardContent>
              {customerOrders.length > 0 ? (
                <div className="space-y-3">
                  {customerOrders.map((order) => (
                    <Link key={order.id} to={`/admin/orders/${order.id}`} className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-secondary/30 transition-colors duration-200">
                      <div>
                        <p className="font-body text-sm font-medium text-primary">{order.id}</p>
                        <p className="font-body text-xs text-muted-foreground">{new Date(order.date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={`${STATUS_COLORS[order.status]} border-0 font-body text-[10px] uppercase tracking-wider`}>{order.status}</Badge>
                        <span className="font-body text-sm font-medium">R{order.total.toFixed(2)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="font-body text-sm text-muted-foreground text-center py-8">No orders found for this customer</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
