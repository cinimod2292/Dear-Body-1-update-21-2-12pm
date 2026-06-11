import assert from "node:assert/strict";
import test from "node:test";
import { getPermissionsForRole, hasPermission } from "./rbac.js";

test("PICKER_PACKER is limited to warehouse permissions", () => {
  assert.deepEqual(getPermissionsForRole("PICKER_PACKER"), ["warehouse:read", "warehouse:write"]);
  assert.equal(hasPermission("PICKER_PACKER", "warehouse:read"), true);
  assert.equal(hasPermission("PICKER_PACKER", "warehouse:write"), true);
  assert.equal(hasPermission("PICKER_PACKER", "dashboard:read"), false);
  assert.equal(hasPermission("PICKER_PACKER", "orders:read"), false);
  assert.equal(hasPermission("PICKER_PACKER", "inventory:read"), false);
  assert.equal(hasPermission("PICKER_PACKER", "settings:read"), false);
});
