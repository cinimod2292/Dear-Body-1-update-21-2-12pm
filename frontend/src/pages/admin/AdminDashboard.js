import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, ArrowUpRight, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { MOCK_ORDERS, SALES_DATA, PRODUCTS } from '../../data/mockData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.08 } }),
};

const STATUS_COLORS = {
  delivered: 'bg-success/10 text-success',
  processing: 'bg-warning/10 text-warning',
  shipped: 'bg-primary/10 text-primary',
  pending: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  confirmed: 'bg-success/10 text-success',
};

export default function AdminDashboard() {
  const totalRevenue = SALES_DATA.reduce((sum, m) => sum + m.revenue, 0);
  const totalOrders = SALES_DATA.reduce((sum, m) => sum + m.orders, 0);

  return (
    <div className="space-y-8">
      <motion.div initial="hidden" animate="visible" variants={fadeUp}>
        <h1 className="font-heading text-2xl sm:text-3xl mb-1">Dashboard</h1>
        <p className="font-body text-sm text-muted-foreground">Overview of your store performance</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `R${(totalRevenue).toLocaleString()}`, icon: DollarSign, change: '+12.5%' },
          { label: 'Total Orders', value: totalOrders.toLocaleString(), icon: ShoppingCart, change: '+8.2%' },
          { label: 'Customers', value: '1,247', icon: Users, change: '+15.3%' },
          { label: 'Products', value: PRODUCTS.length.toString(), icon: Package, change: '+2' },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial="hidden" animate="visible" variants={fadeUp} custom={i}>
            <Card className="shadow-soft">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-md bg-primary/8 flex items-center justify-center">
                    <stat.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-body text-success flex items-center gap-0.5">
                    <TrendingUp className="w-3 h-3" /> {stat.change}
                  </span>
                </div>
                <p className="font-heading text-xl sm:text-2xl">{stat.value}</p>
                <p className="text-xs font-body text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4}>
        <Card className="shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-lg">Revenue Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={SALES_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: 'Inter' }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 12, fontFamily: 'Inter' }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))', boxShadow: 'var(--shadow-soft)' }} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Orders */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5}>
        <Card className="shadow-soft">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-heading text-lg">Recent Orders</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" asChild>
              <Link to="/admin/orders">View All <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Order</th>
                    <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Customer</th>
                    <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 hidden sm:table-cell">Date</th>
                    <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Status</th>
                    <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ORDERS.slice(0, 5).map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="py-3">
                        <Link to={`/admin/orders/${order.id}`} className="font-body text-sm text-primary hover:underline">{order.id}</Link>
                      </td>
                      <td className="py-3 font-body text-sm">{order.customer}</td>
                      <td className="py-3 font-body text-sm text-muted-foreground hidden sm:table-cell">{new Date(order.date).toLocaleDateString()}</td>
                      <td className="py-3">
                        <Badge className={`${STATUS_COLORS[order.status]} border-0 font-body text-[10px] uppercase tracking-wider`}>{order.status}</Badge>
                      </td>
                      <td className="py-3 text-right font-body text-sm font-medium">R{order.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
