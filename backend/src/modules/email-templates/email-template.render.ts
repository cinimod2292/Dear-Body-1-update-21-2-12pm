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
      ? `<br />${links.map((link) => `<a href="${escapeHtml(link.url.trim())}" style="color:${escapeHtml(footerText)};text-decoration:underline;">${lockedText(escapeHtml(link.label.trim()), escapeHtml(footerText))}</a>`).join(" · ")}`
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
  // Consume the complete declaration value, including `{{token}}` braces.
  // Stopping at `}` leaves trailing braces behind and produces invalid CSS such
  // as `background:#ffffff}}`, which causes email clients to discard styles.
  const pattern = new RegExp(`(^|[;\\s\\"])((${property})\\s*:)[^;\\"]*`, "i");
  return tag.replace(pattern, (_match, prefix: string, declaration: string) => `${prefix}${declaration}${value}`);
}

/**
 * Templates saved before theme tokens were introduced contain literal colors.
 * Normalize the known admin/simple-editor shell at send time so those existing
 * templates immediately follow the current theme without destructive DB edits.
 */

const THEME_HEAD = `<head>
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <style>
    :root { color-scheme: only light; supported-color-schemes: light; }
    .db-email-body, .db-email-outer { background-color: {{outerBg}} !important; }
    .db-email-card { background-color: {{contentBg}} !important; }
    .db-email-header { background-color: {{primaryColor}} !important; background-image: linear-gradient(90deg, {{primaryColor}}, {{accentColor}}) !important; }
    .db-email-heading { color: {{headingColor}} !important; -webkit-text-fill-color: {{headingColor}} !important; }
    .db-email-content { color: {{bodyTextColor}} !important; -webkit-text-fill-color: {{bodyTextColor}} !important; }
    .db-email-button { background-color: {{buttonBg}} !important; color: {{buttonTextColor}} !important; -webkit-text-fill-color: {{buttonTextColor}} !important; }
    .db-email-footer { background-color: {{footerBg}} !important; color: {{footerText}} !important; -webkit-text-fill-color: {{footerText}} !important; }
    .db-email-footer a { color: {{footerText}} !important; -webkit-text-fill-color: {{footerText}} !important; }
    [data-ogsc] .db-email-body, [data-ogsc] .db-email-outer { background-color: {{outerBg}} !important; }
    [data-ogsc] .db-email-card { background-color: {{contentBg}} !important; }
    [data-ogsc] .db-email-header { background-color: {{primaryColor}} !important; background-image: linear-gradient(90deg, {{primaryColor}}, {{accentColor}}) !important; }
    [data-ogsc] .db-email-heading { color: {{headingColor}} !important; -webkit-text-fill-color: {{headingColor}} !important; }
    [data-ogsc] .db-email-content { color: {{bodyTextColor}} !important; -webkit-text-fill-color: {{bodyTextColor}} !important; }
    [data-ogsc] .db-email-button { background-color: {{buttonBg}} !important; color: {{buttonTextColor}} !important; -webkit-text-fill-color: {{buttonTextColor}} !important; }
    [data-ogsc] .db-email-footer { background-color: {{footerBg}} !important; color: {{footerText}} !important; -webkit-text-fill-color: {{footerText}} !important; }
    [data-ogsc] .db-email-footer a { color: {{footerText}} !important; -webkit-text-fill-color: {{footerText}} !important; }
    @media (prefers-color-scheme: dark) {
      .db-email-body, .db-email-outer { background-color: {{outerBg}} !important; }
      .db-email-card { background-color: {{contentBg}} !important; }
      .db-email-header { background-color: {{primaryColor}} !important; background-image: linear-gradient(90deg, {{primaryColor}}, {{accentColor}}) !important; }
      .db-email-heading { color: {{headingColor}} !important; -webkit-text-fill-color: {{headingColor}} !important; }
      .db-email-content { color: {{bodyTextColor}} !important; -webkit-text-fill-color: {{bodyTextColor}} !important; }
      .db-email-button { background-color: {{buttonBg}} !important; color: {{buttonTextColor}} !important; -webkit-text-fill-color: {{buttonTextColor}} !important; }
      .db-email-footer { background-color: {{footerBg}} !important; color: {{footerText}} !important; -webkit-text-fill-color: {{footerText}} !important; }
      .db-email-footer a { color: {{footerText}} !important; -webkit-text-fill-color: {{footerText}} !important; }
    }
  </style>
</head>`;

function addClass(tag: string, className: string): string {
  const classMatch = tag.match(/class="([^"]*)"/i);
  if (classMatch) {
    const classes = new Set(classMatch[1].split(/\s+/).filter(Boolean));
    classes.add(className);
    return tag.replace(classMatch[0], `class="${[...classes].join(" ")}"`);
  }
  return tag.replace(/>$/, ` class="${className}">`);
}

function setAttribute(tag: string, name: string, value: string): string {
  const pattern = new RegExp(`\\s${name}="[^"]*"`, "i");
  if (pattern.test(tag)) return tag.replace(pattern, ` ${name}="${value}"`);
  return tag.replace(/>$/, ` ${name}="${value}">`);
}

function setStyleProperty(tag: string, property: string, value: string): string {
  return tag.replace(/style="([^"]*)"/i, (_match, style: string) => {
    const declarations = style.split(";").map((item) => item.trim()).filter(Boolean);
    const propertyPattern = new RegExp(`^${property}\\s*:`, "i");
    const next = declarations.filter((item) => !propertyPattern.test(item));
    next.push(`${property}:${value}`);
    return `style="${next.join(";")};"`;
  });
}

function protectBackground(tag: string, color: string): string {
  let protectedTag = setAttribute(tag, "bgcolor", color);
  protectedTag = setStyleProperty(protectedTag, "background-color", `${color} !important`);
  // A same-color gradient is treated as an image by several dark-mode clients
  // and is therefore less likely to be automatically inverted.
  return setStyleProperty(protectedTag, "background-image", `linear-gradient(${color},${color}) !important`);
}

function protectText(tag: string, color: string): string {
  let protectedTag = setStyleProperty(tag, "color", `${color} !important`);
  return setStyleProperty(protectedTag, "-webkit-text-fill-color", `${color} !important`);
}

function lockedText(content: string, color: string, display: "inline" | "inline-block" = "inline"): string {
  return `<span class="db-email-text-lock" style="display:${display};color:${color} !important;background-color:${color} !important;background-image:linear-gradient(${color},${color}) !important;background-clip:text !important;-webkit-background-clip:text !important;-webkit-text-fill-color:transparent !important;">${content}</span>`;
}

function lockClassContent(html: string, tagName: "td" | "a", className: string, color: string, display: "inline" | "inline-block" = "inline"): string {
  const pattern = new RegExp(`(<${tagName}\\b(?=[^>]*class="[^"]*\\b${className}\\b)[^>]*>)([\\s\\S]*?)(<\\/${tagName}>)`, "i");
  return html.replace(pattern, (_section, opening: string, content: string, closing: string) => `${opening}${lockedText(content, color, display)}${closing}`);
}

function decorateGeneratedShell(html: string): string {
  let decorated = html;
  if (!/<head[\s>]/i.test(decorated)) {
    decorated = decorated.replace(/<html([^>]*)>/i, `<html$1>${THEME_HEAD}`);
  }
  decorated = decorated.replace(/<body\b[^>]*>/i, (tag) => protectBackground(addClass(tag, "db-email-body"), "{{outerBg}}"));
  decorated = decorated.replace(/<table\b[^>]*style="[^"]*padding:24px 0[^"]*"[^>]*>/i, (tag) => protectBackground(addClass(tag, "db-email-outer"), "{{outerBg}}"));
  decorated = decorated.replace(/<table\b[^>]*style="[^"]*max-width:620px[^"]*"[^>]*>/i, (tag) => protectBackground(addClass(tag, "db-email-card"), "{{contentBg}}"));
  decorated = decorated.replace(/<td\b[^>]*background:linear-gradient\(90deg,{{primaryColor}},{{accentColor}}\)[^>]*>/i, (tag) => {
    let header = setAttribute(addClass(tag, "db-email-header"), "bgcolor", "{{primaryColor}}");
    header = setStyleProperty(header, "background-color", "{{primaryColor}} !important");
    return setStyleProperty(header, "background-image", "linear-gradient(90deg,{{primaryColor}},{{accentColor}}) !important");
  });
  decorated = decorated.replace(/<td\b[^>]*style="[^"]*font-size:28px[^"]*"[^>]*>/i, (tag) => protectText(protectBackground(addClass(tag, "db-email-heading"), "{{contentBg}}"), "{{headingColor}}"));
  decorated = decorated.replace(/<td\b[^>]*style="[^"]*font-size:16px[^"]*"[^>]*>/i, (tag) => protectText(protectBackground(addClass(tag, "db-email-content"), "{{contentBg}}"), "{{bodyTextColor}}"));
  decorated = decorated.replace(/<td\b[^>]*style="[^"]*padding:0 32px 20px 32px[^"]*"[^>]*>/i, (tag) => protectBackground(addClass(tag, "db-email-cta-row"), "{{contentBg}}"));
  decorated = decorated.replace(/<a\b[^>]*style="[^"]*display:inline-block[^"]*font-weight:700[^"]*"[^>]*>/i, (tag) => protectText(protectBackground(addClass(tag, "db-email-button"), "{{buttonBg}}"), "{{buttonTextColor}}"));
  decorated = decorated.replace(/<td\b[^>]*style="[^"]*font-size:13px[^"]*"[^>]*>/i, (tag) => protectText(protectBackground(addClass(tag, "db-email-footer"), "{{footerBg}}"), "{{footerText}}"));
  decorated = decorated.replace(/<a\b[^>]*href="(?:mailto:{{supportEmail}}|{{siteUrl}})"[^>]*>/gi, (tag) => protectText(tag, "{{footerText}}"));
  decorated = lockClassContent(decorated, "td", "db-email-heading", "{{headingColor}}", "inline-block");
  decorated = lockClassContent(decorated, "td", "db-email-content", "{{bodyTextColor}}", "inline-block");
  decorated = lockClassContent(decorated, "a", "db-email-button", "{{buttonTextColor}}", "inline-block");
  decorated = decorated.replace(/(<td\b(?=[^>]*class="[^"]*\bdb-email-footer\b)[^>]*>)([\s\S]*?)(<\/td>)/i, (_section, opening: string, content: string, closing: string) => {
    const protectedLinks = content.replace(/(<a\b[^>]*>)([\s\S]*?)(<\/a>)/gi, (_link, linkOpening: string, label: string, linkClosing: string) => {
      if (label.includes('class="db-email-text-lock"')) return `${linkOpening}${label}${linkClosing}`;
      return `${linkOpening}${lockedText(label, "{{footerText}}")}${linkClosing}`;
    });
    return `${opening}${protectedLinks}${closing}`;
  });
  return decorated;
}

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

  return decorateGeneratedShell(normalized);
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
