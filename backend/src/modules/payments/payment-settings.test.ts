import test from "node:test";
import assert from "node:assert/strict";

import { AppError } from "../../lib/errors.js";
import { buildPayfastSignature } from "./payfast.gateway.js";
import { PayfastGateway } from "./payfast.gateway.js";
import { assertAtLeastOneGatewayEnabled, resolveGatewayForRequest } from "./payment-settings.js";

test("gateway rule: rejects when all gateways are disabled", () => {
  assert.throws(() => assertAtLeastOneGatewayEnabled({ stitch: false, payfast: false }), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, "PAYMENT_GATEWAY_MIN_ONE_REQUIRED");
    return true;
  });
});

test("gateway resolver falls back to an enabled provider when requested one is disabled", () => {
  const selected = resolveGatewayForRequest({ stitch: false, payfast: true }, "stitch");
  assert.equal(selected, "payfast");
});

test("gateway resolver defaults to first enabled provider", () => {
  const selected = resolveGatewayForRequest({ stitch: true, payfast: true });
  assert.equal(selected, "stitch");
});

test("PayFast signatures are deterministic and mode-safe inputs can differ", () => {
  const sandboxSig = buildPayfastSignature({
    merchant_id: "sandbox-mid",
    merchant_key: "sandbox-key",
    amount: "299.00",
    m_payment_id: "payfast-order-1",
  }, "sandbox-pass");

  const liveSig = buildPayfastSignature({
    merchant_id: "live-mid",
    merchant_key: "live-key",
    amount: "299.00",
    m_payment_id: "payfast-order-1",
  }, "live-pass");

  assert.notEqual(sandboxSig, liveSig);
  assert.equal(sandboxSig.length, 32);
  assert.equal(liveSig.length, 32);
});

test("PayFast gateway uses sandbox/live endpoint based on runtime mode", async () => {
  const gateway = new PayfastGateway();
  const sandbox = await gateway.initiatePayment({
    mode: "sandbox",
    merchantId: "sandbox-mid",
    apiKey: "sandbox-key",
    webhookSecret: "sandbox-pass",
  }, {
    orderId: "ord_1",
    orderNumber: "1001",
    amount: 129.99,
    currency: "ZAR",
  });
  assert.ok(sandbox.checkoutUrl?.startsWith("https://sandbox.payfast.co.za/eng/process"));

  const live = await gateway.initiatePayment({
    mode: "production",
    merchantId: "live-mid",
    apiKey: "live-key",
    webhookSecret: "live-pass",
  }, {
    orderId: "ord_1",
    orderNumber: "1001",
    amount: 129.99,
    currency: "ZAR",
  });
  assert.ok(live.checkoutUrl?.startsWith("https://www.payfast.co.za/eng/process"));
});
