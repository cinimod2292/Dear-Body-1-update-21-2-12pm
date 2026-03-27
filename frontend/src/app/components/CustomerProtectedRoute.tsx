import { Navigate, Outlet, useLocation } from "react-router";
import { useCustomerAuth } from "../context/CustomerAuthContext";

export function CustomerProtectedRoute() {
  const { customer } = useCustomerAuth();
  const location = useLocation();

  if (!customer) {
    return <Navigate to={`/account/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  return <Outlet />;
}
