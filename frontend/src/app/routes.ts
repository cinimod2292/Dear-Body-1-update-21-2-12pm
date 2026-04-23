import { lazy } from "react";
import { createBrowserRouter } from "react-router";

const Root = lazy(() => import("./components/Root").then((mod) => ({ default: mod.Root })));
const Home = lazy(() => import("./pages/Home"));
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const ProductDetailErrorBoundary = lazy(() => import("./pages/ProductDetailErrorBoundary"));
const Cart = lazy(() => import("./pages/Cart"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CmsPage = lazy(() => import("./pages/CmsPage"));
const CustomerLogin = lazy(() => import("./pages/CustomerLogin"));
const CustomerRegister = lazy(() => import("./pages/CustomerRegister"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const CustomerOrders = lazy(() => import("./pages/CustomerOrders"));
const CustomerOrderDetail = lazy(() => import("./pages/CustomerOrderDetail"));
const CustomerProtectedRoute = lazy(() => import("./components/CustomerProtectedRoute").then((mod) => ({ default: mod.CustomerProtectedRoute })));

const AdminLogin = lazy(() => import("./admin/pages/AdminLogin"));
const AdminLayout = lazy(() => import("./admin/components/AdminLayout"));
const AdminProtectedRoute = lazy(() => import("./admin/components/AdminProtectedRoute").then((mod) => ({ default: mod.AdminProtectedRoute })));
const AdminDashboard = lazy(() => import("./admin/pages/AdminDashboard"));
const AdminProducts = lazy(() => import("./admin/pages/AdminProducts"));
const AdminMedia = lazy(() => import("./admin/pages/AdminMedia"));
const AdminSettings = lazy(() => import("./admin/pages/AdminSettings"));
const AdminCatalogSetup = lazy(() => import("./admin/pages/AdminCatalogSetup"));
const AdminProductEditor = lazy(() => import("./admin/pages/AdminProductEditor"));
const AdminCustomers = lazy(() => import("./admin/pages/AdminCustomers"));
const AdminCustomerDetail = lazy(() => import("./admin/pages/AdminCustomerDetail"));
const AdminOrders = lazy(() => import("./admin/pages/AdminOrders"));
const AdminOrderDetail = lazy(() => import("./admin/pages/AdminOrderDetail"));
const AdminCmsEditor = lazy(() => import("./admin/pages/AdminCmsEditor"));
const AdminOperations = lazy(() => import("./admin/pages/AdminOperations"));
const AdminShippingMethods = lazy(() => import("./admin/pages/AdminShippingMethods"));
const AdminEmailTemplates = lazy(() => import("./admin/pages/AdminEmailTemplates"));

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "shop", Component: Shop },
      { path: "product/:id", Component: ProductDetail, ErrorBoundary: ProductDetailErrorBoundary },
      { path: "cart", Component: Cart },
      { path: "favorites", Component: Favorites },
      { path: "checkout", Component: Checkout },
      { path: "account/login", Component: CustomerLogin },
      { path: "account/register", Component: CustomerRegister },
      {
        path: "account",
        Component: CustomerProtectedRoute,
        children: [
          { index: true, Component: CustomerDashboard },
          { path: "orders", Component: CustomerOrders },
          { path: "orders/:orderId", Component: CustomerOrderDetail },
        ],
      },
      { path: "about", Component: CmsPage },
      { path: "contact", Component: CmsPage },
      { path: "privacy-policy", Component: CmsPage },
      { path: "returns", Component: CmsPage },
      { path: "shipping", Component: CmsPage },
      { path: "terms", Component: CmsPage },
      { path: "pages/:slug", Component: CmsPage },
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
          { path: "cms", Component: AdminCmsEditor },
          { path: "operations", Component: AdminOperations },
          { path: "shipping-methods", Component: AdminShippingMethods },
          { path: "email-templates", Component: AdminEmailTemplates },
        ],
      },
    ],
  },
]);
