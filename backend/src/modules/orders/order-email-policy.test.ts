import assert from "node:assert/strict";
import test from "node:test";
import { shouldSendOrderConfirmation } from "./order-email-policy.js";

test("order confirmation is allowed only for paid orders", () => {
  assert.equal(shouldSendOrderConfirmation("PAID"), true);

  for (const status of ["PENDING", "AWAITING_PAYMENT", "FAILED", "REFUNDED", "CANCELLED"]) {
    assert.equal(shouldSendOrderConfirmation(status), false, `${status} must not trigger an order confirmation`);
  }
});
