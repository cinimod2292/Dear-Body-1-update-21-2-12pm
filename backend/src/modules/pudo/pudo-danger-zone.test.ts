import assert from "node:assert/strict";
import test from "node:test";
import { deleteAllShipmentsSchema } from "./pudo-danger-zone.js";

test("shipment deletion requires the exact destructive phrase", () => {
  assert.equal(deleteAllShipmentsSchema.safeParse({ confirmation: "DELETE ALL SHIPMENTS" }).success, true);
  assert.equal(deleteAllShipmentsSchema.safeParse({ confirmation: "delete all shipments" }).success, false);
  assert.equal(deleteAllShipmentsSchema.safeParse({}).success, false);
});
