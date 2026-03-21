import { RouterProvider } from "react-router";
import { router } from "./routes";
import { CartProvider } from "./context/CartContext";
import { AdminAuthProvider } from "./admin/context/AdminAuthContext";
import { Toaster } from "sonner";

export default function App() {
  return (
    <CartProvider>
      <AdminAuthProvider>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </AdminAuthProvider>
    </CartProvider>
  );
}
