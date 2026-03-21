import { Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { fetchCmsBootstrap } from "../lib/cms";

export function Root() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  useEffect(() => {
    fetchCmsBootstrap()
      .then((bootstrap) => {
        const branding = bootstrap.siteConfig.branding;
        if (branding.fontFamily) {
          document.body.style.fontFamily = branding.fontFamily;
        }
        if (branding.primaryColor) {
          document.documentElement.style.setProperty("--brand-primary", branding.primaryColor);
        }
        if (branding.secondaryColor) {
          document.documentElement.style.setProperty("--brand-secondary", branding.secondaryColor);
        }
        if (branding.faviconUrl) {
          let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = branding.faviconUrl;
        }
      })
      .catch(() => undefined);
  }, []);

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
