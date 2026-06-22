import test from "node:test";
import assert from "node:assert/strict";
import { resolveVariantAddGate, SAVE_PRODUCT_BEFORE_VARIANT_MESSAGE } from "./variant-add-state";

test("resolveVariantAddGate allows managing variants for a saved product", () => {
  const gate = resolveVariantAddGate({ isNew: false, productId: "prod_123" });
  assert.equal(gate.canManageVariants, true);
  assert.equal(gate.disabledReason, undefined);
});

test("resolveVariantAddGate blocks variants for a brand-new product", () => {
  const gate = resolveVariantAddGate({ isNew: true, productId: "new" });
  assert.equal(gate.canManageVariants, false);
  assert.equal(gate.disabledReason, SAVE_PRODUCT_BEFORE_VARIANT_MESSAGE);
});

test("resolveVariantAddGate blocks variants when the product id is missing", () => {
  const gate = resolveVariantAddGate({ isNew: false, productId: undefined });
  assert.equal(gate.canManageVariants, false);
  assert.equal(gate.disabledReason, SAVE_PRODUCT_BEFORE_VARIANT_MESSAGE);
});
