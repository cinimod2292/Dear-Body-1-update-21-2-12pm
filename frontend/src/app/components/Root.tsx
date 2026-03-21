import { Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function Root() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  const hideFooter = pathname === "/checkout";

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 pt-[88px]">
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
