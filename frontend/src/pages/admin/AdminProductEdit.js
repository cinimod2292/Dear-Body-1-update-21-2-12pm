import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { PRODUCTS, CATEGORIES } from '../../data/mockData';
import { toast } from 'sonner';

export default function AdminProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = id ? PRODUCTS.find(p => p.id === parseInt(id)) : null;

  const [form, setForm] = useState({
    name: existing?.name || '',
    description: existing?.description || '',
    price: existing?.price?.toString() || '',
    originalPrice: existing?.originalPrice?.toString() || '',
    category: existing?.category || '',
    stock: existing?.stock?.toString() || '',
    volume: existing?.volume || '',
    ingredients: existing?.ingredients || '',
    isBestseller: existing?.tags?.includes('bestseller') || false,
    isNew: existing?.tags?.includes('new') || false,
    isOnSale: !!existing?.originalPrice,
  });

  const [variants, setVariants] = useState([
    { name: '250ml', price: existing?.price?.toString() || '', stock: '45' },
  ]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addVariant = () => {
    setVariants(prev => [...prev, { name: '', price: '', stock: '' }]);
  };

  const removeVariant = (index) => {
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    toast.success(id ? 'Product updated (simulated)' : 'Product created (simulated)');
    navigate('/admin/products');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild><Link to="/admin/products"><ArrowLeft className="w-4 h-4" /></Link></Button>
        <div className="flex-1">
          <h1 className="font-heading text-2xl">{id ? 'Edit Product' : 'New Product'}</h1>
          <p className="font-body text-sm text-muted-foreground">{id ? `Editing: ${existing?.name || 'Product'}` : 'Add a new product to your store'}</p>
        </div>
        <Button variant="elegant" className="rounded-sm" onClick={handleSave}>
          <Save className="w-4 h-4 mr-1" /> Save Product
        </Button>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-lg">Basic Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Product Name</Label>
                <Input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="e.g., Rocking Fantasy Body Mist" className="rounded-sm font-body" />
              </div>
              <div>
                <Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Description</Label>
                <Textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} placeholder="Describe your product..." className="rounded-sm font-body min-h-[120px]" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Category</Label>
                  <Select value={form.category} onValueChange={(val) => handleChange('category', val)}>
                    <SelectTrigger className="rounded-sm font-body"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Volume / Size</Label>
                  <Input value={form.volume} onChange={(e) => handleChange('volume', e.target.value)} placeholder="e.g., 250ml" className="rounded-sm font-body" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Ingredients</Label>
                <Textarea value={form.ingredients} onChange={(e) => handleChange('ingredients', e.target.value)} placeholder="List product ingredients..." className="rounded-sm font-body" />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-lg">Pricing</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Price ($)</Label>
                  <Input type="number" value={form.price} onChange={(e) => handleChange('price', e.target.value)} className="rounded-sm font-body" />
                </div>
                <div>
                  <Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Compare at Price ($)</Label>
                  <Input type="number" value={form.originalPrice} onChange={(e) => handleChange('originalPrice', e.target.value)} placeholder="Original price" className="rounded-sm font-body" />
                </div>
                <div>
                  <Label className="text-xs font-body uppercase tracking-wider mb-1.5 block">Stock</Label>
                  <Input type="number" value={form.stock} onChange={(e) => handleChange('stock', e.target.value)} className="rounded-sm font-body" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card className="shadow-soft">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="font-heading text-lg">Variants</CardTitle>
              <Button variant="beauty" size="sm" className="text-xs" onClick={addVariant}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Variant
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {variants.map((variant, index) => (
                <div key={index} className="flex items-end gap-3 p-3 rounded-md border border-border">
                  <div className="flex-1">
                    <Label className="text-xs font-body mb-1 block">Name</Label>
                    <Input value={variant.name} onChange={(e) => {
                      const newVariants = [...variants];
                      newVariants[index].name = e.target.value;
                      setVariants(newVariants);
                    }} placeholder="e.g., 250ml" className="rounded-sm font-body h-8 text-sm" />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs font-body mb-1 block">Price</Label>
                    <Input value={variant.price} onChange={(e) => {
                      const newVariants = [...variants];
                      newVariants[index].price = e.target.value;
                      setVariants(newVariants);
                    }} placeholder="0.00" className="rounded-sm font-body h-8 text-sm" />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs font-body mb-1 block">Stock</Label>
                    <Input value={variant.stock} onChange={(e) => {
                      const newVariants = [...variants];
                      newVariants[index].stock = e.target.value;
                      setVariants(newVariants);
                    }} className="rounded-sm font-body h-8 text-sm" />
                  </div>
                  {variants.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => removeVariant(index)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Images */}
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-lg">Images</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {existing?.images?.map((img, i) => (
                  <div key={i} className="aspect-square rounded-md overflow-hidden bg-secondary">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
                <button className="aspect-square rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary/50 transition-colors duration-200">
                  <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs font-body text-muted-foreground">Add Image</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="shadow-soft">
            <CardHeader><CardTitle className="font-heading text-base">Tags & Visibility</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-body text-sm">Best Seller</Label>
                <Switch checked={form.isBestseller} onCheckedChange={(val) => handleChange('isBestseller', val)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="font-body text-sm">New Arrival</Label>
                <Switch checked={form.isNew} onCheckedChange={(val) => handleChange('isNew', val)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="font-body text-sm">On Sale</Label>
                <Switch checked={form.isOnSale} onCheckedChange={(val) => handleChange('isOnSale', val)} />
              </div>
            </CardContent>
          </Card>

          {existing && (
            <Card className="shadow-soft">
              <CardHeader><CardTitle className="font-heading text-base">Preview</CardTitle></CardHeader>
              <CardContent>
                <div className="aspect-[3/4] rounded-md overflow-hidden bg-secondary">
                  <img src={existing.image} alt={existing.name} className="w-full h-full object-cover" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
