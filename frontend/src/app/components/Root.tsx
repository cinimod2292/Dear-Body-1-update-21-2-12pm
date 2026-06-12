import { Outlet, useLocation } from "react-router";
import { useEffect, useRef, useState } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { fetchCmsBootstrap } from "../lib/cms";
import { trackPageLeave, trackPageView } from "../lib/tracking";
import MaintenancePage from "../pages/MaintenancePage";
import UnderConstructionPage from "../pages/UnderConstructionPage";

type SiteStatus = { maintenanceMode: boolean; comingSoon: boolean };

export function Root() {
  const { pathname } = useLocation();
  const [siteStatus, setSiteStatus] = useState<SiteStatus | null>(null);
  const trackRef = useRef<{ sessionId: string; path: string; startedAt: number } | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  useEffect(() => {
    if (trackRef.current) {
      const { sessionId, path, startedAt } = trackRef.current;
      trackPageLeave(sessionId, path, startedAt);
    }
    const result = trackPageView(pathname);
    trackRef.current = result;
    return () => {
      if (trackRef.current) {
        const { sessionId, path, startedAt } = trackRef.current;
        trackPageLeave(sessionId, path, startedAt);
        trackRef.current = null;
      }
    };
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
        setSiteStatus(bootstrap.siteConfig.siteStatus ?? { maintenanceMode: false, comingSoon: false });
      })
      .catch(() => {
        setSiteStatus({ maintenanceMode: false, comingSoon: false });
      });
  }, []);

  const hideFooter = pathname === "/checkout";

  if (siteStatus === null) return <div className="min-h-screen bg-white" aria-busy="true" />;
  if (siteStatus.maintenanceMode) return <MaintenancePage />;
  if (siteStatus.comingSoon) return <UnderConstructionPage />;

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
