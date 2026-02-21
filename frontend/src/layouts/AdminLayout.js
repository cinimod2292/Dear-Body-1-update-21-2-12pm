import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Separator } from '../components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '../components/ui/sheet';
import {
  LayoutDashboard, Package, ShoppingCart, RotateCcw, Truck,
  Users, BarChart3, Menu, ChevronLeft, Store, Settings, Bell
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
  { label: 'Orders', icon: ShoppingCart, path: '/admin/orders' },
  { label: 'Products', icon: Package, path: '/admin/products' },
  { label: 'Customers', icon: Users, path: '/admin/customers' },
  { label: 'Refunds', icon: RotateCcw, path: '/admin/refunds' },
  { label: 'Shipping', icon: Truck, path: '/admin/shipping' },
  { label: 'Reports', icon: BarChart3, path: '/admin/reports' },
];

function SidebarNav({ collapsed, onItemClick }) {
  const location = useLocation();

  return (
    <nav className="space-y-1 px-3">
      {NAV_ITEMS.map((item) => {
        const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onItemClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-body transition-colors duration-200 ${
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
            } ${collapsed ? 'justify-center' : ''}`}
          >
            <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-secondary/50">
      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-50 bg-card border-b border-border px-4 h-14 flex items-center justify-between">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="w-5 h-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-card">
            <div className="p-4">
              <Link to="/admin" className="font-heading text-lg tracking-wider">DEAR BODY</Link>
              <p className="text-xs text-muted-foreground font-body">Admin Dashboard</p>
            </div>
            <Separator />
            <div className="py-2">
              <SidebarNav collapsed={false} />
            </div>
            <Separator />
            <div className="p-3">
              <Link to="/" className="flex items-center gap-2 px-3 py-2 text-sm font-body text-muted-foreground hover:text-foreground transition-colors duration-200">
                <Store className="w-4 h-4" /> View Store
              </Link>
            </div>
          </SheetContent>
        </Sheet>
        <span className="font-heading text-lg tracking-wider">DEAR BODY</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon"><Bell className="w-4.5 h-4.5" /></Button>
          <Button variant="ghost" size="icon"><Settings className="w-4.5 h-4.5" /></Button>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className={`hidden lg:flex flex-col h-screen sticky top-0 bg-card border-r border-border transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
          <div className="p-4 flex items-center justify-between h-16">
            {!collapsed && (
              <div>
                <Link to="/admin" className="font-heading text-lg tracking-wider">DEAR BODY</Link>
                <p className="text-[10px] text-muted-foreground font-body uppercase tracking-wider">Admin</p>
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="ml-auto">
              <ChevronLeft className={`w-4 h-4 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
            </Button>
          </div>
          <Separator />
          <div className="flex-1 py-4 overflow-y-auto">
            <SidebarNav collapsed={collapsed} />
          </div>
          <Separator />
          <div className="p-3">
            <Link to="/" className={`flex items-center gap-2 px-3 py-2 text-sm font-body text-muted-foreground hover:text-foreground transition-colors duration-200 ${collapsed ? 'justify-center' : ''}`}>
              <Store className="w-4 h-4" />
              {!collapsed && 'View Store'}
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <div className="hidden lg:flex items-center justify-between h-16 px-6 bg-card border-b border-border">
            <div />
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon"><Bell className="w-4.5 h-4.5" /></Button>
              <Button variant="ghost" size="icon"><Settings className="w-4.5 h-4.5" /></Button>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center ml-2">
                <span className="text-xs font-body font-semibold text-primary">AD</span>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
