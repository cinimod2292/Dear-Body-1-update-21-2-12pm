const DEFAULT_RENDER_DATA: Record<string, unknown> = {
  firstName: "Customer",
  lastName: "Smith",
  customerName: "Customer Smith",
  storeName: "Dear Body",
  companyName: "Dear Body",
  brandName: "Dear Body",
  supportEmail: "hello@dearbody.com",
  siteUrl: "https://example.com",
  orderNumber: "10001234",
  orderDate: "2026-01-01",
  orderItems: "Hydrating Serum x1, Body Butter x2",
  totalAmount: "$120.00",
  orderTotal: "$120.00",
  amount: "$120.00",
  carrier: "UPS",
  trackingNumber: "1Z12345E0205271688",
  trackingUrl: "https://tracking.example.com/1Z12345E0205271688",
  resetUrl: "https://example.com/reset?token=test",
  verificationUrl: "https://example.com/verify?token=test",
  eventType: "refunded",
  name: "Jane Doe",
  email: "jane@example.com",
  message: "I need help with my order",
  primaryColor: "#f472b6",
  accentColor: "#fb923c",
  buttonBg: "#111827",
  buttonTextColor: "#ffffff",
  headingColor: "#111827",
  bodyTextColor: "#374151",
  contentBg: "#ffffff",
  outerBg: "#f8fafc",
  footerBg: "#111827",
  footerText: "#d1d5db",
};

export function mergeEmailRenderData(
  theme: Record<string, string>,
  sampleData: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...DEFAULT_RENDER_DATA,
    ...sampleData,
    // Theme settings are controlled by the admin portal and must remain
    // authoritative when a send trigger also supplies site/brand values.
    ...theme,
    ...(theme.brandName ? { storeName: theme.brandName, companyName: theme.brandName } : {}),
  };
}

export function retainsSystemDefaultStatus(
  isSystemDefault: boolean,
  patch: Record<string, unknown>,
): boolean {
  const changesRenderedContent = ["subject", "htmlBody", "textBody", "placeholderKeys"].some(
    (field) => Object.prototype.hasOwnProperty.call(patch, field),
  );
  return isSystemDefault && !changesRenderedContent;
}
