import assert from "node:assert/strict";
import test from "node:test";
import { mergeEmailRenderData, retainsSystemDefaultStatus } from "./email-template.render.js";

test("admin email theme values override trigger-provided branding", () => {
  const rendered = mergeEmailRenderData(
    {
      brandName: "Portal Brand",
      siteUrl: "https://portal.example",
      supportEmail: "support@portal.example",
      primaryColor: "#123456",
    },
    {
      firstName: "Ava",
      companyName: "Trigger Company",
      storeName: "Trigger Store",
      siteUrl: "https://trigger.example",
      supportEmail: "trigger@example.com",
      primaryColor: "#ffffff",
    },
  );

  assert.equal(rendered.firstName, "Ava");
  assert.equal(rendered.brandName, "Portal Brand");
  assert.equal(rendered.companyName, "Portal Brand");
  assert.equal(rendered.storeName, "Portal Brand");
  assert.equal(rendered.siteUrl, "https://portal.example");
  assert.equal(rendered.supportEmail, "support@portal.example");
  assert.equal(rendered.primaryColor, "#123456");
});

test("sample data still supplies brand values when the admin theme omits them", () => {
  const rendered = mergeEmailRenderData({}, {
    companyName: "Event Company",
    siteUrl: "https://event.example",
  });

  assert.equal(rendered.companyName, "Event Company");
  assert.equal(rendered.siteUrl, "https://event.example");
});

test("content edits convert a seeded template into an admin customization", () => {
  assert.equal(retainsSystemDefaultStatus(true, { htmlBody: "<p>Custom</p>" }), false);
  assert.equal(retainsSystemDefaultStatus(true, { subject: "Custom subject" }), false);
  assert.equal(retainsSystemDefaultStatus(true, { isEnabled: false }), true);
  assert.equal(retainsSystemDefaultStatus(false, { isEnabled: true }), false);
});

test("theme rendering includes configured logo and footer links", () => {
  const rendered = mergeEmailRenderData({
    brandName: "Portal & Co",
    logoUrl: "https://cdn.example/logo.png?size=1&dark=true",
    footerText: "#abcdef",
    links: [
      { label: "Instagram", url: "https://instagram.example/portal" },
      { label: "", url: "https://ignored.example" },
    ],
  }, {});

  assert.match(String(rendered.logoMarkup), /src="https:\/\/cdn\.example\/logo\.png\?size=1&amp;dark=true"/);
  assert.match(String(rendered.logoMarkup), /alt="Portal &amp; Co"/);
  assert.match(String(rendered.footerLinksMarkup), />Instagram<\/span><\/a>/);
  assert.doesNotMatch(String(rendered.footerLinksMarkup), /ignored/);
});

test("legacy simple-editor HTML is normalized to current theme tokens", async () => {
  const { renderEmailHtml } = await import("./email-template.render.js");
  const legacy = `<!doctype html><html><body style="margin:0;background:#eeeeee;color:#222222;">
    <table role="presentation" style="background:#eeeeee;padding:24px 0;"><tr><td>
      <table role="presentation" style="max-width:620px;background:#ffffff;">
        <tr><td style="background:linear-gradient(90deg,#111111,#222222);">Header</td></tr>
        <tr><td style="font-size:28px;color:#333333;">Heading</td></tr>
        <tr><td style="font-size:16px;color:#444444;">Body</td></tr>
        <tr><td><a href="https://example.com" style="display:inline-block;background:#555555;color:#eeeeee;font-weight:700;">Go</a></td></tr>
        <tr><td style="background:#666666;color:#dddddd;font-size:13px;"><a href="mailto:{{supportEmail}}" style="color:#dddddd;">Help</a></td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const rendered = renderEmailHtml(legacy, {
    outerBg: "#010101",
    contentBg: "#020202",
    primaryColor: "#030303",
    accentColor: "#040404",
    headingColor: "#050505",
    bodyTextColor: "#060606",
    buttonBg: "#070707",
    buttonTextColor: "#080808",
    footerBg: "#090909",
    footerText: "#101010",
    supportEmail: "help@example.com",
    logoMarkup: "<img src=\"logo.png\" />",
    footerLinksMarkup: "<br /><a href=\"social.example\">Social</a>",
  });

  for (const color of ["#010101", "#020202", "#030303", "#040404", "#050505", "#060606", "#070707", "#080808", "#090909", "#101010"]) {
    assert.match(rendered, new RegExp(color));
  }
  assert.doesNotMatch(rendered, /#eeeeee|#111111|#222222|#333333|#444444|#555555|#666666|#dddddd/);
  assert.match(rendered, /mailto:help@example\.com/);
  assert.match(rendered, /<img src="logo\.png" \/>/);
  assert.match(rendered, />Social<\/a>/);
});

test("advanced custom HTML is not structurally rewritten", async () => {
  const { renderEmailHtml } = await import("./email-template.render.js");
  const custom = '<html><body style="background:#123456"><p style="color:#654321">Custom {{firstName}}</p></body></html>';
  const rendered = renderEmailHtml(custom, { firstName: "Ava", outerBg: "#ffffff", bodyTextColor: "#000000" });

  assert.match(rendered, /background:#123456/);
  assert.match(rendered, /color:#654321/);
  assert.match(rendered, /Custom Ava/);
});

test("current tokenized templates render valid inline CSS without trailing braces", async () => {
  const { DEFAULT_EMAIL_TEMPLATES } = await import("./default-templates.js");
  const { renderEmailHtml } = await import("./email-template.render.js");
  const template = DEFAULT_EMAIL_TEMPLATES.find((item) => item.key === "order_confirmation");
  assert.ok(template);

  const rendered = renderEmailHtml(template.htmlBody, {
    firstName: "Dominic",
    orderNumber: "60700174866",
    orderDate: "11 June 2026",
    orderItems: "Rocking Fantasy Deodorant Atomiseur 250ml x1",
    orderTotal: "ZAR 299.00",
    siteUrl: "https://mydearbody.co.za",
    companyName: "Dear Body",
    brandName: "Dear Body",
    supportEmail: "sales@mydearbody.co.za",
    logoMarkup: '<img src="https://cdn.example/logo.png" alt="Dear Body" />',
    footerLinksMarkup: "",
    outerBg: "#f8fafc",
    contentBg: "#ffffff",
    primaryColor: "#ee5ca8",
    accentColor: "#ff8552",
    headingColor: "#111827",
    bodyTextColor: "#374151",
    buttonBg: "#111827",
    buttonTextColor: "#ffffff",
    footerBg: "#ffffff",
    footerText: "#374151",
  });

  assert.doesNotMatch(rendered, /#[0-9a-f]{6}}}/i);
  assert.doesNotMatch(rendered, /{{|}}/);
  assert.match(rendered, /background:#f8fafc;/);
  assert.match(rendered, /background:#ffffff;/);
  assert.match(rendered, /background:linear-gradient\(90deg,#ee5ca8,#ff8552\)/);
  assert.match(rendered, /font-size:28px[^\"]*color:#111827 !important;-webkit-text-fill-color:#111827 !important;/);
  assert.match(rendered, /display:inline-block[^\"]*background-color:#111827 !important;background-image:linear-gradient\(#111827,#111827\) !important;color:#ffffff !important/);
  assert.match(rendered, /<meta name="color-scheme" content="light only" \/>/);
  assert.match(rendered, /class="db-email-outer"[^>]*bgcolor="#f8fafc"/);
  assert.match(rendered, /class="db-email-card"[^>]*bgcolor="#ffffff"/);
  assert.match(rendered, /class="db-email-header"[^>]*bgcolor="#ee5ca8"/);
  assert.match(rendered, /class="db-email-button"[^>]*bgcolor="#111827"/);
  assert.match(rendered, /class="db-email-footer"[^>]*bgcolor="#ffffff"/);
  assert.match(rendered, /\[data-ogsc\] \.db-email-header/);
  assert.match(rendered, /@media \(prefers-color-scheme: dark\)/);
  assert.match(rendered, /:root \{ color-scheme: only light; supported-color-schemes: light; \}/);
  assert.match(rendered, /class="db-email-heading"[^>]*bgcolor="#ffffff"/);
  assert.match(rendered, /class="db-email-content"[^>]*bgcolor="#ffffff"/);
  assert.match(rendered, /class="db-email-cta-row"[^>]*bgcolor="#ffffff"/);
  assert.match(rendered, /background-image:linear-gradient\(#ffffff,#ffffff\) !important/);
  assert.match(rendered, /class="db-email-content"[^>]*><span class="db-email-text-lock"[^>]*background-image:linear-gradient\(#374151,#374151\)[^>]*>Hi Dominic/);
  assert.match(rendered, /class="db-email-button"[^>]*><span class="db-email-text-lock"[^>]*background-image:linear-gradient\(#ffffff,#ffffff\)[^>]*>View Order<\/span>/);
  assert.match(rendered, /mailto:sales@mydearbody\.co\.za[^>]*><span class="db-email-text-lock"[^>]*>sales@mydearbody\.co\.za<\/span>/);
});

test("tracking update text uses gradient-locked theme colors", async () => {
  const { DEFAULT_EMAIL_TEMPLATES } = await import("./default-templates.js");
  const { renderEmailHtml } = await import("./email-template.render.js");
  const template = DEFAULT_EMAIL_TEMPLATES.find((item) => item.key === "pudo_tracking_update");
  assert.ok(template);

  const rendered = renderEmailHtml(template.htmlBody, {
    firstName: "Dominic",
    orderNumber: "73724619669",
    trackingStatusLabel: "Collected from sender",
    waybillNumber: "DLD-CMEXNT",
    orderUrl: "https://mydearbody.co.za/account/orders/order-id",
    siteUrl: "https://mydearbody.co.za",
    companyName: "Dear Body",
    brandName: "Dear Body",
    supportEmail: "sales@mydearbody.co.za",
    logoMarkup: '<img src="https://cdn.example/logo.png" alt="Dear Body" />',
    footerLinksMarkup: "",
    outerBg: "#f8fafc",
    contentBg: "#ffffff",
    primaryColor: "#ee5ca8",
    accentColor: "#ff8552",
    headingColor: "#111827",
    bodyTextColor: "#374151",
    buttonBg: "#111827",
    buttonTextColor: "#ffffff",
    footerBg: "#111827",
    footerText: "#d1d5db",
  });

  assert.match(rendered, /background-image:linear-gradient\(#111827,#111827\)[^>]*>Collected from sender<\/span>/);
  assert.match(rendered, /background-image:linear-gradient\(#374151,#374151\)[^>]*>Hi Dominic,[\s\S]*Waybill:/);
  assert.match(rendered, /background-image:linear-gradient\(#ffffff,#ffffff\)[^>]*>View Order<\/span>/);
  assert.doesNotMatch(rendered, /{{|}}/);
});


test("all bundled email templates pass the rendering audit", async (t) => {
  const { DEFAULT_EMAIL_TEMPLATES } = await import("./default-templates.js");
  const { mergeEmailRenderData, renderEmailHtml, renderTemplateString } = await import("./email-template.render.js");
  const themeOnlyTokens = new Set([
    "primaryColor", "accentColor", "buttonBg", "buttonTextColor", "headingColor",
    "bodyTextColor", "contentBg", "outerBg", "footerBg", "footerText",
    "brandName", "logoMarkup", "footerLinksMarkup",
  ]);
  const expectedProductionTemplates = new Set([
    "welcome_email",
    "password_reset",
    "order_confirmation",
    "admin_new_order_notification",
    "shipping_confirmation",
    "refund_cancellation",
    "payment_confirmation",
    "abandoned_cart_reminder",
    "newsletter_signup_confirmation",
    "contact_form_notification",
    "pudo_tracking_update",
  ]);
  const sampleData = {
    firstName: "Dominic",
    lastName: "Portelli",
    customerName: "Dominic Portelli",
    name: "Dominic Portelli",
    email: "dominic@example.com",
    message: "Please help with my order.",
    orderNumber: "70060565172",
    orderDate: "11 June 2026",
    orderItems: "Rocking Fantasy Deodorant Atomiseur 250ml x1",
    orderTotal: "ZAR 299.00",
    amount: "ZAR 299.00",
    eventType: "refunded",
    carrier: "PUDO",
    trackingNumber: "DLD-CMEXNT",
    trackingUrl: "https://tracking.example.com/DLD-CMEXNT",
    trackingStatusLabel: "Collected from sender",
    waybillNumber: "DLD-CMEXNT",
    orderUrl: "https://mydearbody.co.za/account/orders/order-id",
    checkoutUrl: "https://mydearbody.co.za/checkout",
    resetUrl: "https://mydearbody.co.za/account/reset-password?token=test",
    verificationUrl: "https://mydearbody.co.za/account/verify?token=test",
  };
  const renderData = mergeEmailRenderData({
    brandName: "Dear Body",
    logoUrl: "https://cdn.example.com/dear-body-logo.png",
    primaryColor: "#ee5ca8",
    accentColor: "#ff8552",
    buttonBg: "#111827",
    buttonTextColor: "#ffffff",
    headingColor: "#111827",
    bodyTextColor: "#374151",
    contentBg: "#ffffff",
    outerBg: "#f8fafc",
    footerBg: "#111827",
    footerText: "#d1d5db",
    supportEmail: "sales@mydearbody.co.za",
    siteUrl: "https://mydearbody.co.za",
    links: [{ label: "Instagram", url: "https://instagram.com/mydearbody" }],
  }, sampleData);

  assert.equal(new Set(DEFAULT_EMAIL_TEMPLATES.map((template) => template.key)).size, DEFAULT_EMAIL_TEMPLATES.length);
  for (const key of expectedProductionTemplates) {
    assert.ok(DEFAULT_EMAIL_TEMPLATES.some((template) => template.key === key), `Missing production template: ${key}`);
  }

  for (const template of DEFAULT_EMAIL_TEMPLATES) {
    await t.test(template.key, () => {
      const source = `${template.subject}\n${template.htmlBody}`;
      const sourceTokens = [...source.matchAll(/{{\s*([\w.]+)\s*}}/g)].map((match) => match[1]);
      const undeclaredTokens = [...new Set(sourceTokens.filter((token) => !themeOnlyTokens.has(token) && !template.placeholderKeys.includes(token)))];
      const unusedPlaceholders = template.placeholderKeys.filter((placeholder) => !sourceTokens.includes(placeholder));
      assert.deepEqual(undeclaredTokens, [], `Undeclared placeholders in ${template.key}`);
      assert.deepEqual(unusedPlaceholders, [], `Unused placeholders in ${template.key}`);

      const subject = renderTemplateString(template.subject, renderData);
      const html = renderEmailHtml(template.htmlBody, renderData);
      assert.ok(subject.trim(), `${template.key} rendered an empty subject`);
      assert.doesNotMatch(subject, /{{|}}/, `${template.key} subject has unresolved tokens`);
      assert.doesNotMatch(html, /{{|}}/, `${template.key} HTML has unresolved tokens`);
      assert.doesNotMatch(html, /#[0-9a-f]{6}}}/i, `${template.key} HTML has malformed color tokens`);
      assert.doesNotMatch(html, /href="\s*"/i, `${template.key} rendered an empty link`);
      assert.match(html, /<head>[\s\S]*color-scheme: only light/, `${template.key} lacks dark-mode metadata`);
      assert.match(html, /class="db-email-card"[^>]*bgcolor="#ffffff"/, `${template.key} lacks card protection`);
      assert.match(html, /class="db-email-header"[^>]*bgcolor="#ee5ca8"/, `${template.key} lacks header protection`);
      assert.match(html, /class="db-email-heading"[^>]*><span class="db-email-text-lock"/, `${template.key} lacks heading text protection`);
      assert.match(html, /class="db-email-content"[^>]*><span class="db-email-text-lock"/, `${template.key} lacks body text protection`);
      assert.match(html, /class="db-email-footer"[^>]*bgcolor="#111827"/, `${template.key} lacks footer protection`);
      assert.match(html, /dear-body-logo\.png/, `${template.key} omitted the theme logo`);
      assert.match(html, /instagram\.com\/mydearbody/, `${template.key} omitted theme footer links`);
      assert.match(html, /instagram\.com\/mydearbody[^>]*><span class=\"db-email-text-lock\"/, `${template.key} lacks footer-link text protection`);

      if (/display:inline-block/.test(template.htmlBody)) {
        assert.match(html, /class="db-email-button"[^>]*><span class="db-email-text-lock"/, `${template.key} lacks CTA text protection`);
      }
    });
  }
});
