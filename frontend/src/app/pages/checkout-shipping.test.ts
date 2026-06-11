import assert from "node:assert/strict";
import test from "node:test";
import { firstMethodIdForDeliveryType, methodsForDeliveryType } from "./checkout-shipping";

const methods = [
  { id: "courier", type: "DELIVERY" as const },
  { id: "warehouse", type: "COLLECTION" as const },
];

test("home delivery only exposes delivery methods", () => {
  assert.deepEqual(methodsForDeliveryType(methods, "home"), [methods[0]]);
});

test("collection only exposes collection methods", () => {
  assert.deepEqual(methodsForDeliveryType(methods, "collection"), [methods[1]]);
  assert.equal(firstMethodIdForDeliveryType(methods, "collection"), "warehouse");
});

test("PUDO delivery types do not expose manual shipping methods", () => {
  assert.deepEqual(methodsForDeliveryType(methods, "pudo-locker"), []);
  assert.deepEqual(methodsForDeliveryType(methods, "pudo-door"), []);
});
