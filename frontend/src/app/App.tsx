import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { CartProvider } from "./context/CartContext";
import { AdminAuthProvider } from "./admin/context/AdminAuthContext";
import { Toaster } from "sonner";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { FavoritesProvider } from "./context/FavoritesContext";

export default function App() {
  return (
    <CartProvider>
      <AdminAuthProvider>
        <CustomerAuthProvider>
          <FavoritesProvider>
            <Suspense fallback={<div className="min-h-screen bg-white" aria-busy="true" />}><RouterProvider router={router} /></Suspense>
            <Toaster richColors position="top-right" />
          </FavoritesProvider>
        </CustomerAuthProvider>
      </AdminAuthProvider>
    </CartProvider>
  );
}
