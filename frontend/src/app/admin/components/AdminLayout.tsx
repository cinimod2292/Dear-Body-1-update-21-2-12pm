import { Link, Outlet, useLocation, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
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
  { to: "/admin/customers", label: "Customers", permission: "crm:read" },
  { to: "/admin/orders", label: "Orders", permission: "orders:read" },
  { to: "/admin/operations", label: "Operations", permission: "dashboard:read" },
  { to: "/admin/shipping-methods", label: "Shipping", permission: "settings:read" },
  { to: "/admin/media", label: "Media", permission: "media:read" },
  { to: "/admin/email-templates", label: "Email Templates", permission: "settings:read" },
  { to: "/admin/cms", label: "Website CMS", permission: "settings:read" },
  { to: "/admin/builder", label: "Page Builder", permission: "settings:read" },
  { to: "/admin/staff-users", label: "Admin Users", permission: "settings:read" },
  { to: "/admin/settings", label: "Settings", permission: "settings:read" },
];

function NavLinks({ items, currentPath, onNavigate }: { items: NavItem[]; currentPath: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = currentPath === item.to || (item.to !== "/admin" && currentPath.startsWith(`${item.to}/`));
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-pink-50 text-pink-600" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout() {
  const { session, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => hasPermission(session?.permissions ?? [], item.permission)),
    [session?.permissions],
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop sidebar */}
      <aside className="w-64 border-r border-gray-200 bg-white p-5 hidden md:flex md:flex-col flex-shrink-0">
        <div className="mb-6">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Dear Body</p>
          <h1 className="text-xl font-black text-gray-900">Admin Portal</h1>
        </div>
        <NavLinks items={navItems} currentPath={location.pathname} />
      </aside>

      {/* Mobile nav overlay */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white p-5 flex flex-col overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Dear Body</p>
                <h1 className="text-xl font-black text-gray-900">Admin Portal</h1>
              </div>
              <button type="button" onClick={() => setMobileNavOpen(false)} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label="Close menu">✕</button>
            </div>
            <NavLinks items={navItems} currentPath={location.pathname} onNavigate={() => setMobileNavOpen(false)} />
            <div className="mt-auto pt-4 border-t border-gray-100 space-y-2">
              <p className="text-xs text-gray-400">{session?.email}</p>
              <button type="button" onClick={() => { navigate("/"); setMobileNavOpen(false); }} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-left">View Storefront</button>
              <button type="button" onClick={() => { void logout(); navigate("/admin/login", { replace: true }); }} className="w-full px-3 py-2 rounded-lg bg-gray-900 text-white text-sm text-left">Logout</button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger — mobile only */}
            <button
              type="button"
              className="md:hidden p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M2 4.5h14M2 9h14M2 13.5h14" />
              </svg>
            </button>
            <div>
              <p className="text-xs text-gray-400 hidden md:block">Signed in as</p>
              <p className="text-sm font-semibold text-gray-800">{session?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="hidden sm:block px-3 py-2 rounded-lg border border-gray-200 text-sm" onClick={() => navigate("/")}>
              View Storefront
            </button>
            <button
              type="button"
              onClick={() => { void logout(); navigate("/admin/login", { replace: true }); }}
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
