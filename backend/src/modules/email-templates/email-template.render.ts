export type EmailThemeLink = { label: string; url: string };
export type EmailTheme = Record<string, unknown>;

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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function themeString(theme: EmailTheme, key: string): string | undefined {
  const value = theme[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function themeLinks(theme: EmailTheme): EmailThemeLink[] {
  if (!Array.isArray(theme.links)) return [];
  return theme.links.filter((link): link is EmailThemeLink => {
    if (!link || typeof link !== "object") return false;
    const candidate = link as Record<string, unknown>;
    return typeof candidate.label === "string" && !!candidate.label.trim()
      && typeof candidate.url === "string" && !!candidate.url.trim();
  });
}

export function mergeEmailRenderData(
  theme: EmailTheme,
  sampleData: Record<string, unknown>,
): Record<string, unknown> {
  const brandName = themeString(theme, "brandName");
  const logoUrl = themeString(theme, "logoUrl");
  const footerText = themeString(theme, "footerText") ?? String(DEFAULT_RENDER_DATA.footerText);
  const links = themeLinks(theme);

  return {
    ...DEFAULT_RENDER_DATA,
    ...sampleData,
    ...Object.fromEntries(Object.entries(theme).filter(([, value]) => typeof value === "string")),
    ...(brandName ? { brandName, storeName: brandName, companyName: brandName } : {}),
    logoMarkup: logoUrl
      ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName ?? "Store logo")}" style="display:block;max-width:180px;max-height:72px;width:auto;height:auto;margin:0 auto 10px auto;" />`
      : "",
    footerLinksMarkup: links.length
      ? `<br />${links.map((link) => `<a href="${escapeHtml(link.url.trim())}" style="color:${escapeHtml(footerText)};text-decoration:underline;">${escapeHtml(link.label.trim())}</a>`).join(" · ")}`
      : "",
  };
}

export function renderTemplateString(template: string, data: Record<string, unknown>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_match, key: string) => {
    const value = data[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function replaceStyleValue(tag: string, property: string, value: string): string {
  const pattern = new RegExp(`(${property}:)([^;"}]+)`, "i");
  return tag.replace(pattern, `$1${value}`);
}

/**
 * Templates saved before theme tokens were introduced contain literal colors.
 * Normalize the known admin/simple-editor shell at send time so those existing
 * templates immediately follow the current theme without destructive DB edits.
 */
export function normalizeLegacyThemeHtml(html: string): string {
  const isGeneratedShell = /max-width:620px/i.test(html)
    && /background:linear-gradient\(90deg,/i.test(html);
  if (!isGeneratedShell) return html;

  let normalized = html.replace(
    /background:linear-gradient\(90deg,(?!{{primaryColor}})[^,;)]+,(?!{{accentColor}})[^;)]+\)/gi,
    "background:linear-gradient(90deg,{{primaryColor}},{{accentColor}})",
  );

  normalized = normalized.replace(/<body\b[^>]*style="[^"]*"[^>]*>/gi, (tag) => {
    let next = replaceStyleValue(tag, "background", "{{outerBg}}");
    next = replaceStyleValue(next, "color", "{{bodyTextColor}}");
    return next;
  });
  normalized = normalized.replace(/<table\b[^>]*style="[^"]*padding:24px 0[^"]*"[^>]*>/gi, (tag) => replaceStyleValue(tag, "background", "{{outerBg}}"));
  normalized = normalized.replace(/<table\b[^>]*style="[^"]*max-width:620px[^"]*"[^>]*>/gi, (tag) => replaceStyleValue(tag, "background", "{{contentBg}}"));
  normalized = normalized.replace(/<td\b[^>]*style="[^"]*font-size:28px[^"]*"[^>]*>/gi, (tag) => replaceStyleValue(tag, "color", "{{headingColor}}"));
  normalized = normalized.replace(/<td\b[^>]*style="[^"]*font-size:16px[^"]*"[^>]*>/gi, (tag) => replaceStyleValue(tag, "color", "{{bodyTextColor}}"));
  normalized = normalized.replace(/<a\b[^>]*style="[^"]*display:inline-block[^"]*font-weight:700[^"]*"[^>]*>/gi, (tag) => {
    let next = replaceStyleValue(tag, "background", "{{buttonBg}}");
    next = replaceStyleValue(next, "color", "{{buttonTextColor}}");
    return next;
  });
  normalized = normalized.replace(/<td\b[^>]*style="[^"]*font-size:13px[^"]*"[^>]*>/gi, (tag) => {
    let next = replaceStyleValue(tag, "background", "{{footerBg}}");
    next = replaceStyleValue(next, "color", "{{footerText}}");
    return next;
  });
  normalized = normalized.replace(/<a\b[^>]*href="(?:mailto:{{supportEmail}}|{{siteUrl}})"[^>]*>/gi, (tag) => replaceStyleValue(tag, "color", "{{footerText}}"));
  normalized = normalized.replace(/(<td\b[^>]*background:linear-gradient\(90deg,{{primaryColor}},{{accentColor}}\)[^>]*>)(?!\s*{{logoMarkup}})/i, "$1{{logoMarkup}}");
  normalized = normalized.replace(/(<td\b[^>]*style="[^"]*font-size:13px[^"]*"[^>]*>)([\s\S]*?)(<\/td>)/gi, (section, opening, content, closing) => {
    if (content.includes("{{footerLinksMarkup}}")) return section;
    return `${opening}${content}{{footerLinksMarkup}}${closing}`;
  });

  return normalized;
}

export function renderEmailHtml(html: string, data: Record<string, unknown>): string {
  return renderTemplateString(normalizeLegacyThemeHtml(html), data);
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
