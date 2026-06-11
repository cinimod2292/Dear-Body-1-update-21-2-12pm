import assert from "node:assert/strict";
import test from "node:test";
import { canAccessAdminPath } from "./access.js";

test("PICKER_PACKER can access only warehouse routes", () => {
  assert.equal(canAccessAdminPath("PICKER_PACKER", "/admin/warehouse"), true);
  assert.equal(canAccessAdminPath("PICKER_PACKER", "/admin/warehouse/orders/order-1"), true);
  assert.equal(canAccessAdminPath("PICKER_PACKER", "/admin"), false);
  assert.equal(canAccessAdminPath("PICKER_PACKER", "/admin/orders"), false);
  assert.equal(canAccessAdminPath("PICKER_PACKER", "/admin/fulfillment/collection-schedule"), false);
  assert.equal(canAccessAdminPath("PICKER_PACKER", "/admin/warehouse-reports"), false);
});

test("other staff roles retain their existing admin route access", () => {
  assert.equal(canAccessAdminPath("STORE_MANAGER", "/admin"), true);
  assert.equal(canAccessAdminPath("WAREHOUSE_OPERATOR", "/admin/fulfillment/collection-schedule"), true);
});
