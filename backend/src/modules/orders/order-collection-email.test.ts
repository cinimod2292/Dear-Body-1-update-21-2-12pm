import assert from "node:assert/strict";
import test from "node:test";
import { isWarehouseCollectionOrder, shouldSendWarehouseCollectionReadyEmail } from "./order-collection-email.js";

test("identifies normal warehouse collection shipping methods", () => {
  assert.equal(isWarehouseCollectionOrder({ shippingMethod: { code: "warehouse_collection", name: "Collect from warehouse" } }), true);
  assert.equal(isWarehouseCollectionOrder({ shippingMethod: { code: "click-and-collect", name: "Click & Collect" } }), true);
  assert.equal(isWarehouseCollectionOrder({ shippingMethod: { code: "pickup", name: "Store pickup" } }), true);
});

test("does not treat PUDO or courier delivery as warehouse collection", () => {
  assert.equal(isWarehouseCollectionOrder({ pudoDeliveryType: "locker", shippingMethod: { code: "collection", name: "Collection" } }), false);
  assert.equal(isWarehouseCollectionOrder({ shippingMethod: { code: "standard", name: "Standard delivery" } }), false);
  assert.equal(isWarehouseCollectionOrder({ shippingMethod: null }), false);
});

test("collection-ready email triggers once on transition to packed", () => {
  assert.equal(shouldSendWarehouseCollectionReadyEmail({ previousFulfillmentStatus: "UNFULFILLED", nextFulfillmentStatus: "PACKED", isWarehouseCollection: true, alreadySent: false }), true);
  assert.equal(shouldSendWarehouseCollectionReadyEmail({ previousFulfillmentStatus: "PACKED", nextFulfillmentStatus: "PACKED", isWarehouseCollection: true, alreadySent: false }), false);
  assert.equal(shouldSendWarehouseCollectionReadyEmail({ previousFulfillmentStatus: "UNFULFILLED", nextFulfillmentStatus: "PACKED", isWarehouseCollection: false, alreadySent: false }), false);
  assert.equal(shouldSendWarehouseCollectionReadyEmail({ previousFulfillmentStatus: "UNFULFILLED", nextFulfillmentStatus: "PACKED", isWarehouseCollection: true, alreadySent: true }), false);
});
