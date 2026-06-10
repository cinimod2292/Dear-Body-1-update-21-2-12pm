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
