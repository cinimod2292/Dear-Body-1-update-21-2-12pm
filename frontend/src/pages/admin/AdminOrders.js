import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, Download, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { MOCK_ORDERS } from '../../data/mockData';

const STATUS_COLORS = {
  delivered: 'bg-success/10 text-success',
  processing: 'bg-warning/10 text-warning',
  shipped: 'bg-primary/10 text-primary',
  pending: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

export default function AdminOrders() {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = MOCK_ORDERS.filter(order => {
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) || order.customer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl sm:text-3xl mb-1">Orders</h1>
        <p className="font-body text-sm text-muted-foreground">{MOCK_ORDERS.length} total orders</p>
      </motion.div>

      <Card className="shadow-soft">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search orders..." className="pl-9 h-9 rounded-sm font-body text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-xs font-body"><Filter className="w-3.5 h-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="text-xs"><Download className="w-3.5 h-3.5 mr-1" /> Export</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 pr-4">Order</th>
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 pr-4">Customer</th>
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 pr-4 hidden md:table-cell">Date</th>
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 pr-4 hidden sm:table-cell">Items</th>
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 pr-4">Status</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 pr-4">Total</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors duration-200">
                    <td className="py-3.5 pr-4"><Link to={`/admin/orders/${order.id}`} className="font-body text-sm text-primary hover:underline">{order.id}</Link></td>
                    <td className="py-3.5 pr-4">
                      <div><p className="font-body text-sm">{order.customer}</p><p className="font-body text-xs text-muted-foreground">{order.email}</p></div>
                    </td>
                    <td className="py-3.5 pr-4 font-body text-sm text-muted-foreground hidden md:table-cell">{new Date(order.date).toLocaleDateString()}</td>
                    <td className="py-3.5 pr-4 font-body text-sm hidden sm:table-cell">{order.items.length} items</td>
                    <td className="py-3.5 pr-4"><Badge className={`${STATUS_COLORS[order.status]} border-0 font-body text-[10px] uppercase tracking-wider`}>{order.status}</Badge></td>
                    <td className="py-3.5 pr-4 text-right font-body text-sm font-medium">R{order.total.toFixed(2)}</td>
                    <td className="py-3.5 text-right">
                      <Button variant="ghost" size="icon" asChild><Link to={`/admin/orders/${order.id}`}><Eye className="w-4 h-4" /></Link></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredOrders.length === 0 && (
            <div className="text-center py-10"><p className="font-body text-muted-foreground">No orders found</p></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
