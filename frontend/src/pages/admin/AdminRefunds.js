import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { MOCK_REFUNDS } from '../../data/mockData';
import { toast } from 'sonner';

const REFUND_STATUS_COLORS = {
  approved: 'bg-success/10 text-success',
  pending: 'bg-warning/10 text-warning',
  processing: 'bg-primary/10 text-primary',
  rejected: 'bg-destructive/10 text-destructive',
};

export default function AdminRefunds() {
  const [refunds, setRefunds] = useState(MOCK_REFUNDS);

  const updateStatus = (refundId, newStatus) => {
    setRefunds(prev => prev.map(r => r.id === refundId ? { ...r, status: newStatus } : r));
    toast.success(`Refund ${refundId} updated to ${newStatus}`);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl sm:text-3xl mb-1">Refunds</h1>
        <p className="font-body text-sm text-muted-foreground">Manage return requests and refunds</p>
      </motion.div>

      <Card className="shadow-soft">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground p-4">Refund ID</th>
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground p-4">Order</th>
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground p-4 hidden sm:table-cell">Customer</th>
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground p-4 hidden md:table-cell">Reason</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground p-4">Amount</th>
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground p-4">Status</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground p-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr key={refund.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors duration-200">
                    <td className="p-4 font-body text-sm font-medium">{refund.id}</td>
                    <td className="p-4 font-body text-sm text-primary">{refund.orderId}</td>
                    <td className="p-4 font-body text-sm hidden sm:table-cell">{refund.customer}</td>
                    <td className="p-4 font-body text-sm text-muted-foreground hidden md:table-cell">{refund.reason}</td>
                    <td className="p-4 text-right font-body text-sm font-medium">R{refund.amount.toFixed(2)}</td>
                    <td className="p-4"><Badge className={`${REFUND_STATUS_COLORS[refund.status]} border-0 font-body text-[10px] uppercase tracking-wider`}>{refund.status}</Badge></td>
                    <td className="p-4 text-right">
                      <Select value={refund.status} onValueChange={(val) => updateStatus(refund.id, val)}>
                        <SelectTrigger className="w-32 h-8 text-xs font-body"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
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
