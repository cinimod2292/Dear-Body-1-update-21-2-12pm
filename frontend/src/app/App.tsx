import { Component, ErrorInfo, ReactNode, Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { CartProvider } from "./context/CartContext";
import { AdminAuthProvider } from "./admin/context/AdminAuthContext";
import { Toaster } from "sonner";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { BUILD_MARKER } from "./lib/build-marker";

type AppErrorBoundaryState = { error: Error | null };

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[app-error-boundary] render crash", {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      buildMarker: BUILD_MARKER,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-red-50 text-red-900 p-4 text-sm">
          <p className="font-semibold">Something went wrong loading the app.</p>
          <p>{BUILD_MARKER}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}
