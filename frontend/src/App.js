import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { Toaster } from './components/ui/sonner';

// Layouts
import StoreLayout from './layouts/StoreLayout';
import AdminLayout from './layouts/AdminLayout';

// Storefront Pages
import HomePage from './pages/store/HomePage';
import CategoryPage from './pages/store/CategoryPage';
import ProductListPage from './pages/store/ProductListPage';
import ProductDetailPage from './pages/store/ProductDetailPage';
import SearchResults from './pages/store/SearchResults';
import WishlistPage from './pages/store/WishlistPage';

// Shopping Flow
import CartPage from './pages/store/CartPage';
import CheckoutPage from './pages/store/CheckoutPage';
import OrderConfirmation from './pages/store/OrderConfirmation';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminOrders from './pages/admin/AdminOrders';
import AdminOrderDetail from './pages/admin/AdminOrderDetail';
import AdminRefunds from './pages/admin/AdminRefunds';
import AdminShipping from './pages/admin/AdminShipping';
import AdminProducts from './pages/admin/AdminProducts';
import AdminProductEdit from './pages/admin/AdminProductEdit';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminCustomerProfile from './pages/admin/AdminCustomerProfile';
import AdminReports from './pages/admin/AdminReports';

function App() {
  return (
    <StoreProvider>
      <Router>
        <Routes>
          {/* Storefront */}
          <Route element={<StoreLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/products" element={<ProductListPage />} />
            <Route path="/product/:slug" element={<ProductDetailPage />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-confirmation" element={<OrderConfirmation />} />
          </Route>

          {/* Admin */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            <Route path="refunds" element={<AdminRefunds />} />
            <Route path="shipping" element={<AdminShipping />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductEdit />} />
            <Route path="products/:id/edit" element={<AdminProductEdit />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="customers/:id" element={<AdminCustomerProfile />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>
        </Routes>
      </Router>
      <Toaster position="top-right" richColors />
    </StoreProvider>
  );
}

export default App;
