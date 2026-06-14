/**
 * Analytics abstraction layer supporting GA4 and Meta Pixel.
 * Configure via VITE_GA4_MEASUREMENT_ID and VITE_META_PIXEL_ID env vars.
 */

const GA4_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID as string | undefined;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
    _fbq?: any;
    clarity?: (...args: any[]) => void;
  }
}

let ga4Loaded = false;
let pixelLoaded = false;

function loadGA4() {
  if (!GA4_ID || ga4Loaded || typeof window === "undefined") return;
  ga4Loaded = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA4_ID, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
  document.head.appendChild(script);
}

function loadMetaPixel() {
  if (!META_PIXEL_ID || pixelLoaded || typeof window === "undefined") return;
  pixelLoaded = true;

  /* eslint-disable */
  (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq?.("init", META_PIXEL_ID);
  window.fbq?.("track", "PageView");
}

function loadClarity() {
  if (!CLARITY_ID || typeof window === "undefined") return;
  (function(c: any, l: any, a: any, r: any, i: any, t?: any, y?: any) {
    c[a] = c[a] || function() { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", CLARITY_ID);
}

// Initialise on first call
export function initAnalytics() {
  loadGA4();
  loadMetaPixel();
  loadClarity();
}

// GA4 page view
export function trackGA4PageView(path: string, title?: string) {
  if (!GA4_ID || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title || document.title,
    send_to: GA4_ID,
  });
}

// GA4 + Pixel: view item (product page)
export function trackViewItem(product: {
  id: string;
  name: string;
  price: number;
  brand?: string;
  category?: string;
  currency?: string;
}) {
  const currency = product.currency || "ZAR";
  if (window.gtag && GA4_ID) {
    window.gtag("event", "view_item", {
      currency,
      value: product.price,
      items: [{
        item_id: product.id,
        item_name: product.name,
        item_brand: product.brand,
        item_category: product.category,
        price: product.price,
        quantity: 1,
      }],
    });
  }
  window.fbq?.("track", "ViewContent", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    value: product.price,
    currency,
  });
}

// GA4 + Pixel: add to cart
export function trackAddToCart(product: {
  id: string;
  name: string;
  price: number;
  quantity: number;
  brand?: string;
  category?: string;
  currency?: string;
}) {
  const currency = product.currency || "ZAR";
  if (window.gtag && GA4_ID) {
    window.gtag("event", "add_to_cart", {
      currency,
      value: product.price * product.quantity,
      items: [{
        item_id: product.id,
        item_name: product.name,
        item_brand: product.brand,
        item_category: product.category,
        price: product.price,
        quantity: product.quantity,
      }],
    });
  }
  window.fbq?.("track", "AddToCart", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    value: product.price * product.quantity,
    currency,
  });
}

// GA4 + Pixel: begin checkout
export function trackBeginCheckout(cart: {
  total: number;
  itemCount: number;
  currency?: string;
}) {
  const currency = cart.currency || "ZAR";
  if (window.gtag && GA4_ID) {
    window.gtag("event", "begin_checkout", { currency, value: cart.total });
  }
  window.fbq?.("track", "InitiateCheckout", {
    value: cart.total,
    currency,
    num_items: cart.itemCount,
  });
}

// GA4 + Pixel: purchase
export function trackPurchase(order: {
  orderId: string;
  total: number;
  tax?: number;
  shipping?: number;
  items: Array<{ id: string; name: string; price: number; quantity: number }>;
  currency?: string;
}) {
  const currency = order.currency || "ZAR";
  if (window.gtag && GA4_ID) {
    window.gtag("event", "purchase", {
      transaction_id: order.orderId,
      currency,
      value: order.total,
      tax: order.tax || 0,
      shipping: order.shipping || 0,
      items: order.items.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
    });
  }
  window.fbq?.("track", "Purchase", {
    value: order.total,
    currency,
    content_ids: order.items.map((i) => i.id),
    content_type: "product",
    num_items: order.items.reduce((sum, i) => sum + i.quantity, 0),
  });
}

// GA4: search
export function trackSearch(query: string) {
  if (window.gtag && GA4_ID) {
    window.gtag("event", "search", { search_term: query });
  }
}
