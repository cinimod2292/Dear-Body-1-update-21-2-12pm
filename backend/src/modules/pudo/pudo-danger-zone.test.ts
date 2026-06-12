import assert from "node:assert/strict";
import test from "node:test";
import { deleteAllShipmentsSchema } from "./pudo-danger-zone.js";

test("shipment deletion requires the exact destructive phrase and a password", () => {
  assert.equal(deleteAllShipmentsSchema.safeParse({ confirmation: "DELETE ALL SHIPMENTS", password: "secret" }).success, true);
  assert.equal(deleteAllShipmentsSchema.safeParse({ confirmation: "DELETE ALL SHIPMENTS" }).success, false);
  assert.equal(deleteAllShipmentsSchema.safeParse({ confirmation: "delete all shipments", password: "secret" }).success, false);
  assert.equal(deleteAllShipmentsSchema.safeParse({}).success, false);
});
