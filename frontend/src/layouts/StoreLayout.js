import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/store/Navbar';
import { Footer } from '../components/store/Footer';
import { CartDrawer } from '../components/store/CartDrawer';

export default function StoreLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <CartDrawer />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
