import { createBrowserRouter } from "react-router";
import { Root } from "./components/Root";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import About from "./pages/About";
import AdminLogin from "./admin/pages/AdminLogin";
import AdminLayout from "./admin/components/AdminLayout";
import { AdminProtectedRoute } from "./admin/components/AdminProtectedRoute";
import AdminDashboard from "./admin/pages/AdminDashboard";
import AdminProducts from "./admin/pages/AdminProducts";
import AdminMedia from "./admin/pages/AdminMedia";
import AdminSettings from "./admin/pages/AdminSettings";
import AdminCatalogSetup from "./admin/pages/AdminCatalogSetup";
import AdminProductEditor from "./admin/pages/AdminProductEditor";
import AdminCustomers from "./admin/pages/AdminCustomers";
import AdminCustomerDetail from "./admin/pages/AdminCustomerDetail";
import AdminOrders from "./admin/pages/AdminOrders";
import AdminOrderDetail from "./admin/pages/AdminOrderDetail";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "shop", Component: Shop },
      { path: "product/:id", Component: ProductDetail },
      { path: "cart", Component: Cart },
      { path: "checkout", Component: Checkout },
      { path: "about", Component: About },
    ],
  },
  {
    path: "/admin/login",
    Component: AdminLogin,
  },
  {
    path: "/admin",
    Component: AdminProtectedRoute,
    children: [
      {
        Component: AdminLayout,
        children: [
          { index: true, Component: AdminDashboard },
          { path: "products", Component: AdminProducts },
          { path: "products/:productId", Component: AdminProductEditor },
          { path: "catalog-setup", Component: AdminCatalogSetup },
          { path: "customers", Component: AdminCustomers },
          { path: "customers/:customerId", Component: AdminCustomerDetail },
          { path: "orders", Component: AdminOrders },
          { path: "orders/:orderId", Component: AdminOrderDetail },
          { path: "media", Component: AdminMedia },
          { path: "settings", Component: AdminSettings },
        ],
      },
    ],
  },
]);
