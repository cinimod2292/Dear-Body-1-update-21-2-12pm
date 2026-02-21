import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Eye, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Avatar, AvatarFallback } from '../../components/ui/avatar';
import { MOCK_CUSTOMERS } from '../../data/mockData';

export default function AdminCustomers() {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = MOCK_CUSTOMERS.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl sm:text-3xl mb-1">Customers</h1>
        <p className="font-body text-sm text-muted-foreground">{MOCK_CUSTOMERS.length} registered customers</p>
      </motion.div>

      <Card className="shadow-soft">
        <CardHeader className="pb-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search customers..." className="pl-9 h-9 rounded-sm font-body text-sm" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Customer</th>
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 hidden md:table-cell">Email</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Orders</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Total Spent</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 hidden sm:table-cell">Joined</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors duration-200">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-body font-semibold">
                            {customer.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-body text-sm">{customer.name}</span>
                      </div>
                    </td>
                    <td className="py-3 font-body text-sm text-muted-foreground hidden md:table-cell">{customer.email}</td>
                    <td className="py-3 text-right font-body text-sm">{customer.orders}</td>
                    <td className="py-3 text-right font-body text-sm font-medium">R{customer.totalSpent.toFixed(2)}</td>
                    <td className="py-3 text-right font-body text-sm text-muted-foreground hidden sm:table-cell">{new Date(customer.joined).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild><Link to={`/admin/customers/${customer.id}`}><Eye className="w-4 h-4" /></Link></Button>
                        <Button variant="ghost" size="icon"><Mail className="w-4 h-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
