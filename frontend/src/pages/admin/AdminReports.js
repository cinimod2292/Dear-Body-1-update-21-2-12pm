import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingCart, TrendingUp, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { SALES_DATA, PRODUCTS, MOCK_ORDERS } from '../../data/mockData';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CATEGORY_DATA = [
  { name: 'Body Care', value: 35, color: 'hsl(350, 42%, 52%)' },
  { name: 'Fragrance', value: 28, color: 'hsl(340, 45%, 32%)' },
  { name: 'Gift Sets', value: 18, color: 'hsl(30, 30%, 60%)' },
  { name: 'Home Fragrance', value: 12, color: 'hsl(25, 60%, 50%)' },
  { name: 'Mens', value: 7, color: 'hsl(200, 45%, 55%)' },
];

const DAILY_DATA = [
  { day: 'Mon', orders: 24, revenue: 1890 },
  { day: 'Tue', orders: 32, revenue: 2450 },
  { day: 'Wed', orders: 28, revenue: 2100 },
  { day: 'Thu', orders: 38, revenue: 3200 },
  { day: 'Fri', orders: 45, revenue: 3800 },
  { day: 'Sat', orders: 52, revenue: 4200 },
  { day: 'Sun', orders: 35, revenue: 2800 },
];

export default function AdminReports() {
  const totalRevenue = SALES_DATA.reduce((sum, m) => sum + m.revenue, 0);
  const totalOrders = SALES_DATA.reduce((sum, m) => sum + m.orders, 0);
  const avgOrderValue = totalRevenue / totalOrders;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl sm:text-3xl mb-1">Reports</h1>
        <p className="font-body text-sm text-muted-foreground">Sales analytics and performance metrics</p>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `R${totalRevenue.toLocaleString()}`, icon: DollarSign, change: '+12.5%', up: true },
          { label: 'Total Orders', value: totalOrders.toLocaleString(), icon: ShoppingCart, change: '+8.2%', up: true },
          { label: 'Avg. Order Value', value: `R${avgOrderValue.toFixed(2)}`, icon: TrendingUp, change: '+3.1%', up: true },
          { label: 'Conversion Rate', value: '2.8%', icon: Users, change: '-0.5%', up: false },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-md bg-primary/8 flex items-center justify-center">
                    <stat.icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className={`text-xs font-body flex items-center gap-0.5 ${stat.up ? 'text-success' : 'text-destructive'}`}>
                    {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                  </span>
                </div>
                <p className="font-heading text-xl">{stat.value}</p>
                <p className="text-xs font-body text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="revenue" className="font-body text-xs">Revenue</TabsTrigger>
          <TabsTrigger value="orders" className="font-body text-xs">Orders</TabsTrigger>
          <TabsTrigger value="categories" className="font-body text-xs">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-lg">Monthly Revenue</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={SALES_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fontFamily: 'Inter' }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12, fontFamily: 'Inter' }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.1)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-lg">Weekly Orders</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={DAILY_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fontFamily: 'Inter' }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12, fontFamily: 'Inter' }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-lg">Sales by Category</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={CATEGORY_DATA} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {CATEGORY_DATA.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Top Products */}
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="font-heading text-lg">Top Selling Products</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {PRODUCTS.sort((a, b) => b.reviews - a.reviews).slice(0, 5).map((product, i) => (
              <div key={product.id} className="flex items-center gap-4">
                <span className="text-sm font-body text-muted-foreground w-6">{i + 1}.</span>
                <div className="w-10 h-12 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm truncate">{product.name}</p>
                  <p className="font-body text-xs text-muted-foreground">{product.reviews} reviews</p>
                </div>
                <span className="font-body text-sm font-medium">R{product.price.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
