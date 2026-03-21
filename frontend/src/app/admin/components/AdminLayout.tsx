import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useMemo } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { hasPermission } from "../permissions";

interface NavItem {
  to: string;
  label: string;
  permission: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/admin", label: "Dashboard", permission: "dashboard:read" },
  { to: "/admin/products", label: "Products", permission: "catalog:read" },
  { to: "/admin/catalog-setup", label: "Catalog Setup", permission: "catalog:read" },
  { to: "/admin/media", label: "Media", permission: "media:read" },
  { to: "/admin/settings", label: "Settings", permission: "settings:read" },
];

export default function AdminLayout() {
  const { session, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => hasPermission(session?.permissions ?? [], item.permission)),
    [session?.permissions],
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 border-r border-gray-200 bg-white p-5 hidden md:block">
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase">Dear Body</p>
          <h1 className="text-xl font-black text-gray-900">Admin Portal</h1>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-pink-50 text-pink-600" : "text-gray-600 hover:bg-gray-100"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">Signed in as</p>
            <p className="text-sm font-semibold text-gray-800">{session?.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm"
              onClick={() => navigate("/")}
            >
              View Storefront
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/admin/login", { replace: true });
              }}
              className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
