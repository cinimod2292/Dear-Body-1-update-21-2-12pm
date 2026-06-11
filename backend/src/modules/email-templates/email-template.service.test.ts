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
  assert.match(rendered, /font-size:28px[^\"]*color:#111827;/);
  assert.match(rendered, /display:inline-block[^\"]*background:#111827;color:#ffffff;/);
});
