import { Navigate, Outlet, useLocation } from "react-router";
import { useAdminAuth } from "../context/AdminAuthContext";
import { canAccessAdminPath } from "../access";

export function AdminProtectedRoute() {
  const { session, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading admin session...</div>;
  }

  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (!canAccessAdminPath(session.role, location.pathname)) {
    return <Navigate to="/admin/warehouse" replace />;
  }

  return <Outlet />;
}
