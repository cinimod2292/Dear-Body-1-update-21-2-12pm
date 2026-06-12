import assert from "node:assert/strict";
import test from "node:test";
import { deleteAllOrdersSchema } from "./orders.schemas.js";
import { summarizeInventoryRestore } from "./order-danger-zone.js";

test("danger-zone confirmation requires the exact destructive phrase and a password", () => {
  assert.equal(deleteAllOrdersSchema.safeParse({ confirmation: "DELETE ALL ORDERS", password: "secret" }).success, true);
  assert.equal(deleteAllOrdersSchema.safeParse({ confirmation: "DELETE ALL ORDERS" }).success, false);
  assert.equal(deleteAllOrdersSchema.safeParse({ confirmation: "delete all orders", password: "secret" }).success, false);
  assert.equal(deleteAllOrdersSchema.safeParse({}).success, false);
});

test("inventory restoration groups quantities by variant and ignores detached items", () => {
  const result = summarizeInventoryRestore([
    { variantId: "variant-a", quantity: 2 },
    { variantId: "variant-b", quantity: 1 },
    { variantId: "variant-a", quantity: 3 },
    { variantId: null, quantity: 9 },
    { variantId: "variant-b", quantity: 0 },
  ]);

  assert.deepEqual([...result.entries()], [["variant-a", 5], ["variant-b", 1]]);
});
