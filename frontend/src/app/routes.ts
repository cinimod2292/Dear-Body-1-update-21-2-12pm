import { lazy } from "react";
import { createBrowserRouter, redirect } from "react-router";

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
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CustomerDashboard = lazy(() => import("./pages/CustomerDashboard"));
const CustomerOrderDetail = lazy(() => import("./pages/CustomerOrderDetail"));
const CustomerProtectedRoute = lazy(() => import("./components/CustomerProtectedRoute").then((mod) => ({ default: mod.CustomerProtectedRoute })));
const BuilderPreview = lazy(() => import("./pages/BuilderPreview"));
const BuilderPage = lazy(() => import("./pages/BuilderPage"));
const MaintenancePage = lazy(() => import("./pages/MaintenancePage"));
const UnderConstructionPage = lazy(() => import("./pages/UnderConstructionPage"));

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
const AdminBuilderHome = lazy(() => import("./admin/pages/AdminBuilderHome"));
const AdminBuilderPagesList = lazy(() => import("./admin/pages/AdminBuilderPagesList"));
const AdminOperations = lazy(() => import("./admin/pages/AdminOperations"));
const AdminShippingMethods = lazy(() => import("./admin/pages/AdminShippingMethods"));
const AdminEmailTemplates = lazy(() => import("./admin/pages/AdminEmailTemplates"));
const AdminStaffUsers = lazy(() => import("./admin/pages/AdminStaffUsers"));
const AdminPudoTest = lazy(() => import("./admin/pages/AdminPudoTest"));
const AdminPudoShipments = lazy(() => import("./admin/pages/AdminPudoShipments"));
const AdminPudoRates = lazy(() => import("./admin/pages/AdminPudoRates"));

export const router = createBrowserRouter([
  {
    path: "/maintenance",
    Component: MaintenancePage,
  },
  {
    path: "/coming-soon",
    Component: UnderConstructionPage,
  },
  {
    path: "/builder-preview",
    Component: BuilderPreview,
  },
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
      { path: "account/forgot-password", Component: ForgotPassword },
      { path: "account/reset-password", Component: ResetPassword },
      {
        path: "account",
        Component: CustomerProtectedRoute,
        children: [
          { index: true, Component: CustomerDashboard },
          { path: "orders", loader: () => redirect("/account?tab=orders") },
          { path: "orders/:orderId", Component: CustomerOrderDetail },
        ],
      },
      { path: "about", Component: BuilderPage },
      { path: "contact", Component: BuilderPage },
      { path: "returns", Component: BuilderPage },
      { path: "sale", Component: BuilderPage },
      { path: "brand", Component: BuilderPage },
      { path: "faq", Component: BuilderPage },
      { path: "delivery", Component: BuilderPage },
      { path: "campaign", Component: BuilderPage },
      { path: "privacy-policy", Component: CmsPage },
      { path: "shipping", Component: CmsPage },
      { path: "terms", Component: CmsPage },
      // Redirect old /pages/<builder-slug> URLs to the canonical builder paths.
      { path: "pages/about", loader: () => redirect("/about") },
      { path: "pages/contact", loader: () => redirect("/contact") },
      { path: "pages/returns", loader: () => redirect("/returns") },
      { path: "pages/faq", loader: () => redirect("/faq") },
      { path: "pages/delivery", loader: () => redirect("/delivery") },
      { path: "pages/brand", loader: () => redirect("/brand") },
      { path: "pages/sale", loader: () => redirect("/sale") },
      { path: "pages/campaign", loader: () => redirect("/campaign") },
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
          { path: "products/new", Component: AdminProductEditor },
          { path: "products/:productId", Component: AdminProductEditor },
          { path: "catalog-setup", Component: AdminCatalogSetup },
          { path: "customers", Component: AdminCustomers },
          { path: "customers/:customerId", Component: AdminCustomerDetail },
          { path: "orders", Component: AdminOrders },
          { path: "orders/:orderId", Component: AdminOrderDetail },
          { path: "media", Component: AdminMedia },
          { path: "settings", Component: AdminSettings },
          { path: "cms", Component: AdminCmsEditor },
          { path: "builder", Component: AdminBuilderPagesList },
          { path: "builder/:pageKey", Component: AdminBuilderHome },
          { path: "operations", Component: AdminOperations },
          { path: "shipping-methods", Component: AdminShippingMethods },
          { path: "email-templates", Component: AdminEmailTemplates },
          { path: "staff-users", Component: AdminStaffUsers },
          { path: "pudo-test", Component: AdminPudoTest },
          { path: "pudo-shipments", Component: AdminPudoShipments },
          { path: "pudo-rates", Component: AdminPudoRates },
        ],
      },
    ],
  },
]);
