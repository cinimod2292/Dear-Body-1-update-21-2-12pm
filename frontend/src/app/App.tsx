import { RouterProvider } from "react-router";
import { router } from "./routes";
import { CartProvider } from "./context/CartContext";
import { AdminAuthProvider } from "./admin/context/AdminAuthContext";
import { Toaster } from "sonner";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";

export default function App() {
  return (
    <CartProvider>
      <AdminAuthProvider>
        <CustomerAuthProvider>
          <RouterProvider router={router} />
          <Toaster richColors position="top-right" />
        </CustomerAuthProvider>
      </AdminAuthProvider>
    </CartProvider>
  );
}
