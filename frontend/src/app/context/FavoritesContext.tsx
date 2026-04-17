import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCustomerAuth } from "./CustomerAuthContext";

interface FavoritesContextValue {
  favorites: string[];
  isFavorited: (productId: string | number) => boolean;
  toggleFavorite: (productId: string | number) => boolean;
}

const STORAGE_PREFIX = "storefront_customer_favorites";
const Ctx = createContext<FavoritesContextValue | undefined>(undefined);

function normalizeProductId(productId: string | number) {
  return String(productId);
}

function getStorageKey(customerId: string) {
  return `${STORAGE_PREFIX}:${customerId}`;
}

function readFavoritesForCustomer(customerId: string): string[] {
  try {
    const raw = localStorage.getItem(getStorageKey(customerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeProductId(item as string | number));
  } catch {
    return [];
  }
}

function writeFavoritesForCustomer(customerId: string, favorites: string[]) {
  localStorage.setItem(getStorageKey(customerId), JSON.stringify(Array.from(new Set(favorites))));
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { customer } = useCustomerAuth();
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!customer?.id) {
      setFavorites([]);
      return;
    }

    setFavorites(readFavoritesForCustomer(customer.id));
  }, [customer?.id]);

  useEffect(() => {
    if (!customer?.id) return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== getStorageKey(customer.id)) return;
      setFavorites(readFavoritesForCustomer(customer.id));
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [customer?.id]);

  const requireCustomer = useCallback(() => {
    if (customer?.id) return customer.id;

    const next = `${window.location.pathname}${window.location.search}`;
    toast.error("Sign in required to save favorites", {
      description: "Please log in or create an account to save products.",
      action: {
        label: "Log in",
        onClick: () => window.location.assign(`/account/login?next=${encodeURIComponent(next)}`),
      },
      cancel: {
        label: "Register",
        onClick: () => window.location.assign(`/account/register?next=${encodeURIComponent(next)}`),
      },
    });

    return null;
  }, [customer?.id]);

  const isFavorited = useCallback((productId: string | number) => {
    const normalized = normalizeProductId(productId);
    return favorites.includes(normalized);
  }, [favorites]);

  const toggleFavorite = useCallback((productId: string | number) => {
    const customerId = requireCustomer();
    if (!customerId) return false;

    const normalized = normalizeProductId(productId);
    let nextIsFavorited = false;

    setFavorites((current) => {
      if (current.includes(normalized)) {
        const next = current.filter((id) => id !== normalized);
        writeFavoritesForCustomer(customerId, next);
        nextIsFavorited = false;
        return next;
      }

      const next = [...current, normalized];
      writeFavoritesForCustomer(customerId, next);
      nextIsFavorited = true;
      return next;
    });

    return nextIsFavorited;
  }, [requireCustomer]);

  const value = useMemo(() => ({ favorites, isFavorited, toggleFavorite }), [favorites, isFavorited, toggleFavorite]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFavorites() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
