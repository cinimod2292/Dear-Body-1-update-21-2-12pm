import assert from "node:assert/strict";
import test from "node:test";
import { adminShippingMethodCreateSchema } from "./ops.schemas.js";

test("delivery shipping methods do not require a collection address", () => {
  const result = adminShippingMethodCreateSchema.parse({
    name: "Courier",
    price: 85,
    isActive: true,
  });

  assert.equal(result.type, "DELIVERY");
  assert.equal(result.collectionAddress, undefined);
});

test("collection shipping methods require and retain a collection address", () => {
  const collectionAddress = {
    line1: "12 Main Road",
    city: "Cape Town",
    postalCode: "8001",
    country: "South Africa",
  };
  const result = adminShippingMethodCreateSchema.parse({
    name: "Collect from store",
    price: 0,
    isActive: true,
    type: "COLLECTION",
    collectionAddress,
  });

  assert.deepEqual(result.collectionAddress, collectionAddress);
});

test("collection shipping methods reject a missing collection address", () => {
  const result = adminShippingMethodCreateSchema.safeParse({
    name: "Collect from store",
    price: 0,
    isActive: true,
    type: "COLLECTION",
  });

  assert.equal(result.success, false);
});
