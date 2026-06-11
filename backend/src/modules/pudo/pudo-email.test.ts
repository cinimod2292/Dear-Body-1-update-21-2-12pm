import assert from "node:assert/strict";
import test from "node:test";
import { emailTemplateKeyForPudoStatus, normalizePudoTrackingStatus } from "./pudo-email.js";

test("ready-for-collection statuses select the dedicated customer template", () => {
  assert.equal(emailTemplateKeyForPudoStatus("ready_for_collection"), "order_ready_for_collection");
  assert.equal(emailTemplateKeyForPudoStatus("Ready for collection"), "order_ready_for_collection");
  assert.equal(emailTemplateKeyForPudoStatus("ready-for-collection"), "order_ready_for_collection");
});

test("other PUDO statuses continue using the generic tracking template", () => {
  assert.equal(emailTemplateKeyForPudoStatus("collected"), "pudo_tracking_update");
  assert.equal(emailTemplateKeyForPudoStatus("in_transit"), "pudo_tracking_update");
  assert.equal(emailTemplateKeyForPudoStatus("delivered"), "pudo_tracking_update");
});

test("PUDO status normalization handles API label variants", () => {
  assert.equal(normalizePudoTrackingStatus(" Ready-for Collection "), "ready_for_collection");
});
