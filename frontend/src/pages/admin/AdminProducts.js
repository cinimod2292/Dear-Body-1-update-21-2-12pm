import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Trash2, MoreHorizontal, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { PRODUCTS } from '../../data/mockData';
import { toast } from 'sonner';

export default function AdminProducts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState(PRODUCTS);

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success('Product deleted (simulated)');
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl mb-1">Products</h1>
          <p className="font-body text-sm text-muted-foreground">{products.length} products</p>
        </div>
        <Button variant="elegant" className="rounded-sm" asChild>
          <Link to="/admin/products/new"><Plus className="w-4 h-4 mr-1" /> Add Product</Link>
        </Button>
      </motion.div>

      <Card className="shadow-soft">
        <CardHeader className="pb-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search products..." className="pl-9 h-9 rounded-sm font-body text-sm" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Product</th>
                  <th className="text-left text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 hidden sm:table-cell">Category</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Price</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 hidden md:table-cell">Stock</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3 hidden md:table-cell">Rating</th>
                  <th className="text-right text-xs font-body font-medium uppercase tracking-wider text-muted-foreground pb-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors duration-200">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-12 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-body text-sm font-medium truncate">{product.name}</p>
                          {product.tags?.includes('bestseller') && <Badge className="bg-primary/10 text-primary border-0 text-[10px] font-body mt-0.5">Best Seller</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 hidden sm:table-cell">
                      <span className="font-body text-xs text-muted-foreground capitalize">{product.category.replace('-', ' ')}</span>
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-body text-sm">R{product.price.toFixed(2)}</span>
                      {product.originalPrice && <span className="font-body text-xs text-muted-foreground line-through block">R{product.originalPrice.toFixed(2)}</span>}
                    </td>
                    <td className="py-3 text-right hidden md:table-cell">
                      <span className={`font-body text-sm ${product.stock < 20 ? 'text-warning' : ''}`}>{product.stock}</span>
                    </td>
                    <td className="py-3 text-right hidden md:table-cell">
                      <span className="font-body text-sm">{product.rating}</span>
                    </td>
                    <td className="py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link to={`/admin/products/${product.id}/edit`} className="flex items-center gap-2"><Edit className="w-3.5 h-3.5" /> Edit</Link></DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(product.id)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
