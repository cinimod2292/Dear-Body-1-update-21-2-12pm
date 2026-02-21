import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { SHIPPING_RATES } from '../../data/mockData';
import { toast } from 'sonner';
import { Truck, Plus, Save } from 'lucide-react';

export default function AdminShipping() {
  const [rates, setRates] = useState(SHIPPING_RATES);
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(true);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState('50');

  const handleSave = () => {
    toast.success('Shipping settings saved (simulated)');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-heading text-2xl sm:text-3xl mb-1">Shipping</h1>
        <p className="font-body text-sm text-muted-foreground">Manage shipping methods and rates</p>
      </motion.div>

      {/* General Settings */}
      <Card className="shadow-soft">
        <CardHeader><CardTitle className="font-heading text-lg">General Settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-body text-sm font-medium">Free Shipping</p>
              <p className="font-body text-xs text-muted-foreground">Offer free shipping above a threshold</p>
            </div>
            <Switch checked={freeShippingEnabled} onCheckedChange={setFreeShippingEnabled} />
          </div>
          {freeShippingEnabled && (
            <div className="max-w-xs">
              <Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Minimum Order Amount ($)</Label>
              <Input value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(e.target.value)} className="rounded-sm font-body" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rate Table */}
      <Card className="shadow-soft">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="font-heading text-lg flex items-center gap-2"><Truck className="w-4 h-4" /> Shipping Rates</CardTitle>
          <Button variant="beauty" size="sm" className="text-xs"><Plus className="w-3.5 h-3.5 mr-1" /> Add Rate</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rates.map((rate) => (
              <div key={rate.id} className="flex items-center gap-4 p-4 rounded-md border border-border">
                <div className="flex-1">
                  <p className="font-body text-sm font-medium">{rate.name}</p>
                  <p className="font-body text-xs text-muted-foreground">{rate.description}</p>
                </div>
                <div className="text-right">
                  <p className="font-body text-sm font-medium">R{rate.price.toFixed(2)}</p>
                  {rate.freeAbove && <p className="font-body text-xs text-muted-foreground">Free over R{rate.freeAbove}</p>}
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-6" />
          <Button variant="elegant" onClick={handleSave} className="rounded-sm"><Save className="w-4 h-4 mr-1" /> Save Settings</Button>
        </CardContent>
      </Card>
    </div>
  );
}
