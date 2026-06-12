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
  assert.match(String(rendered.footerLinksMarkup), />Instagram<\/a>/);
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

test("baked-in logo img in DB template is replaced by logoMarkup token, not duplicated", async () => {
  const { renderEmailHtml } = await import("./email-template.render.js");
  // Simulates a DB-stored template where the logo was rendered to an <img> tag
  // instead of remaining as {{logoMarkup}}. The normalization pass must swap the
  // baked-in img for the theme logoMarkup rather than inserting a second logo.
  const dbHtml = `<!doctype html><html><body style="margin:0;background:#f0f0f0;color:#222222;">
    <table role="presentation" style="background:#f0f0f0;padding:24px 0;"><tr><td align="center">
      <table role="presentation" style="max-width:620px;background:#ffffff;">
        <tr><td style="padding:18px 24px;background:linear-gradient(90deg,#ee5ca8,#ff8552);text-align:center;">
          <img src="https://cdn.old.example/old-logo.png" alt="Old Logo" style="display:block;max-width:180px;" />
          <div style="font-size:20px;font-weight:800;color:#ffffff;">Dear Body</div>
        </td></tr>
        <tr><td style="font-size:28px;color:#111827;">Heading</td></tr>
        <tr><td style="font-size:16px;color:#374151;">Body text.</td></tr>
        <tr><td style="background:#111827;color:#d1d5db;font-size:13px;">Footer</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const rendered = renderEmailHtml(dbHtml, {
    primaryColor: "#ee5ca8", accentColor: "#ff8552",
    outerBg: "#f0f0f0", contentBg: "#ffffff",
    headingColor: "#111827", bodyTextColor: "#374151",
    footerBg: "#111827", footerText: "#d1d5db",
    logoMarkup: '<img src="https://cdn.new.example/new-logo.png" alt="New Logo" />',
    footerLinksMarkup: "",
  });

  // New theme logo appears exactly once (baked-in old logo is replaced)
  assert.match(rendered, /new-logo\.png/);
  assert.doesNotMatch(rendered, /old-logo\.png/);
  // Logo count: the new-logo img should appear only once
  const logoMatches = rendered.match(/new-logo\.png/g);
  assert.equal(logoMatches?.length, 1, "logo must appear exactly once");
});

test("logoMarkup misplaced in content area is moved to header, not duplicated", async () => {
  const { renderEmailHtml } = await import("./email-template.render.js");
  // Simulates a DB template saved with {{logoMarkup}} inside the heading td
  // (wrong location). The normalization must relocate it to the header only.
  const dbHtml = `<!doctype html><html><body style="margin:0;background:#f0f0f0;color:#222222;">
    <table role="presentation" style="background:#f0f0f0;padding:24px 0;"><tr><td align="center">
      <table role="presentation" style="max-width:620px;background:#ffffff;">
        <tr><td style="padding:18px 24px;background:linear-gradient(90deg,#ee5ca8,#ff8552);text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#ffffff;">Dear Body</div>
        </td></tr>
        <tr><td style="font-size:28px;color:#111827;">{{logoMarkup}}Welcome!</td></tr>
        <tr><td style="font-size:16px;color:#374151;">Body text.</td></tr>
        <tr><td style="background:#111827;color:#d1d5db;font-size:13px;">Footer</td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  const rendered = renderEmailHtml(dbHtml, {
    primaryColor: "#ee5ca8", accentColor: "#ff8552",
    outerBg: "#f0f0f0", contentBg: "#ffffff",
    headingColor: "#111827", bodyTextColor: "#374151",
    footerBg: "#111827", footerText: "#d1d5db",
    logoMarkup: '<img src="https://cdn.example/logo.png" alt="Logo" />',
    footerLinksMarkup: "",
  });

  const logoMatches = rendered.match(/cdn\.example\/logo\.png/g);
  assert.equal(logoMatches?.length, 1, "logo must appear exactly once");
  // Logo must be in the header (inside the gradient td), not inside the heading td
  assert.match(rendered, /linear-gradient[\s\S]{0,300}cdn\.example\/logo\.png/);
  assert.doesNotMatch(rendered, /cdn\.example\/logo\.png[\s\S]{0,50}Welcome!/);
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
  assert.match(rendered, /<a\b(?=[^>]*class="db-email-button")(?=[^>]*background-color:#111827 !important)(?=[^>]*color:#ffffff !important)[^>]*>/);
  assert.match(rendered, /<meta name="color-scheme" content="light only" \/>/);
  assert.match(rendered, /class="db-email-outer"[^>]*bgcolor="#f8fafc"/);
  assert.match(rendered, /class="db-email-card"[^>]*bgcolor="#ffffff"/);
  assert.match(rendered, /class="db-email-header"[^>]*bgcolor="#ee5ca8"/);
  assert.match(rendered, /class="db-email-button"[^>]*bgcolor="#111827"/);
  assert.match(rendered, /class="db-email-footer"[^>]*bgcolor="#ffffff"/);
  assert.match(rendered, /\[data-ogsc\] \.db-email-header/);
  assert.match(rendered, /\[data-ogsb\] \.db-email-header/);
  assert.match(rendered, /forced-color-adjust:none/);
  assert.doesNotMatch(rendered, /-webkit-text-fill-color:transparent/);
  assert.doesNotMatch(rendered, /background-clip:text/);
  assert.doesNotMatch(rendered, /mso-style-textfill-type:gradient/);
  assert.match(rendered, /mso-background-alt:#ffffff/);
  assert.match(rendered, /mso-shading:#ffffff/);
  assert.match(rendered, /@media \(prefers-color-scheme: dark\)/);
  assert.match(rendered, /:root \{ color-scheme: only light; supported-color-schemes: light; \}/);
  assert.match(rendered, /class="db-email-heading"[^>]*bgcolor="#ffffff"/);
  assert.match(rendered, /class="db-email-content"[^>]*bgcolor="#ffffff"/);
  assert.match(rendered, /class="db-email-cta-row"[^>]*bgcolor="#ffffff"/);
  assert.match(rendered, /background-image:linear-gradient\(#ffffff,#ffffff\) !important/);
  assert.match(rendered, /<td\b(?=[^>]*class="db-email-content")(?=[^>]*color:#374151 !important)[^>]*>Hi Dominic/);
  assert.match(rendered, /<a\b(?=[^>]*class="db-email-button")(?=[^>]*color:#ffffff !important)[^>]*>View Order<\/a>/);
  assert.match(rendered, /mailto:sales@mydearbody\.co\.za[^>]*color:#374151 !important[^>]*>sales@mydearbody\.co\.za<\/a>/);
});

test("tracking update text uses explicit theme colors without transparent fills", async () => {
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

  assert.match(rendered, /<td\b(?=[^>]*class="db-email-heading")(?=[^>]*color:#111827 !important)[^>]*>Collected from sender<\/td>/);
  assert.match(rendered, /<td\b(?=[^>]*class="db-email-content")(?=[^>]*color:#374151 !important)[^>]*>Hi Dominic,[\s\S]*Waybill:/);
  assert.match(rendered, /<a\b(?=[^>]*class="db-email-button")(?=[^>]*color:#ffffff !important)[^>]*>View Order<\/a>/);
  assert.doesNotMatch(rendered, /-webkit-text-fill-color:transparent|background-clip:text|mso-style-textfill-type:gradient/);
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
    "order_ready_for_collection",
    "warehouse_collection_ready",
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
      assert.match(html, /\[data-ogsb\] \.db-email-card/, `${template.key} lacks Outlook background overrides`);
      assert.doesNotMatch(html, /-webkit-text-fill-color:transparent|background-clip:text|mso-style-textfill-type:gradient/, `${template.key} uses text effects that Outlook recolors`);
      assert.match(html, /class="db-email-card"[^>]*bgcolor="#ffffff"/, `${template.key} lacks card protection`);
      assert.match(html, /<table\b(?=[^>]*class="db-email-card")(?=[^>]*mso-background-alt:#ffffff)[^>]*>/, `${template.key} lacks classic Outlook card shading`);
      assert.match(html, /class="db-email-header"[^>]*bgcolor="#ee5ca8"/, `${template.key} lacks header protection`);
      assert.match(html, /<td\b(?=[^>]*class="db-email-heading")(?=[^>]*color:#111827 !important)[^>]*>/, `${template.key} lacks heading text color`);
      assert.match(html, /<td\b(?=[^>]*class="db-email-content")(?=[^>]*color:#374151 !important)[^>]*>/, `${template.key} lacks body text color`);
      assert.match(html, /class="db-email-footer"[^>]*bgcolor="#111827"/, `${template.key} lacks footer protection`);
      assert.match(html, /dear-body-logo\.png/, `${template.key} omitted the theme logo`);
      assert.match(html, /instagram\.com\/mydearbody/, `${template.key} omitted theme footer links`);
      assert.match(html, /instagram\.com\/mydearbody[^>]*color:#d1d5db !important/, `${template.key} lacks footer-link text color`);

      if (/display:inline-block/.test(template.htmlBody)) {
        assert.match(html, /<a\b(?=[^>]*class="db-email-button")(?=[^>]*color:#ffffff !important)[^>]*>/, `${template.key} lacks CTA text color`);
      }
    });
  }
});
