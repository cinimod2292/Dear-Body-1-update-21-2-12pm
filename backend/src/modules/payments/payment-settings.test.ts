import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { AppError } from "../../lib/errors.js";
import { buildPayfastRedirectSource, buildPayfastSignature, buildPayfastSignatureSource } from "./payfast.gateway.js";
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

test("PayFast signature generation trims values and excludes empty fields", () => {
  const source = buildPayfastSignatureSource({
    merchant_id: " 10000100 ",
    merchant_key: " key12345 ",
    item_name: " Order 42 ",
    email_address: "   ",
  }, " passphrase ");
  assert.equal(source, "merchant_id=10000100&merchant_key=key12345&item_name=Order+42&passphrase=passphrase");
});

test("PayFast signature generation follows canonical checkout field order", () => {
  const source = buildPayfastSignatureSource({
    m_payment_id: "payfast-1",
    return_url: "https://example.com/return",
    merchant_key: "abc123",
    merchant_id: "10000100",
  });
  assert.equal(source, "merchant_id=10000100&merchant_key=abc123&return_url=https%3A%2F%2Fexample.com%2Freturn&m_payment_id=payfast-1");
});

test("PayFast signature generation uses PHP-compatible encoding", () => {
  const source = buildPayfastSignatureSource({
    merchant_id: "10000100",
    merchant_key: "abc123",
    return_url: "https://shop.example/r?x=1~2",
    item_name: "A+B ~ C",
  });
  assert.equal(source, "merchant_id=10000100&merchant_key=abc123&return_url=https%3A%2F%2Fshop.example%2Fr%3Fx%3D1%7E2&item_name=A%2BB+%7E+C");
});

test("PayFast passphrase changes signature only when present", () => {
  const fields = {
    merchant_id: "10000100",
    merchant_key: "abc123",
    amount: "129.99",
  };
  const noPass = buildPayfastSignature(fields);
  const emptyPass = buildPayfastSignature(fields, "   ");
  const withPass = buildPayfastSignature(fields, "secret");

  assert.equal(noPass, emptyPass);
  assert.notEqual(noPass, withPass);
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

test("PayFast redirect URL signature matches generated payload source", async () => {
  const gateway = new PayfastGateway();
  const initiated = await gateway.initiatePayment({
    mode: "sandbox",
    merchantId: "10000100",
    apiKey: "abc123",
    webhookSecret: "passphrase",
  }, {
    orderId: "order_1",
    orderNumber: "5001",
    amount: 99.5,
    currency: "ZAR",
    returnUrl: "https://shop.example/checkout?order=1",
    cancelUrl: "https://shop.example/checkout?cancelled=1",
  });

  const url = new URL(initiated.checkoutUrl!);
  const encodedSource = url.search.slice(1).replace(/&signature=.*$/, "");
  const rebuilt = crypto.createHash("md5").update(`${encodedSource}&passphrase=passphrase`).digest("hex");
  assert.equal(url.searchParams.get("signature"), rebuilt);
});

test("PayFast redirect query exactly matches signed fields (minus passphrase)", async () => {
  const gateway = new PayfastGateway();
  const initiated = await gateway.initiatePayment({
    mode: "sandbox",
    merchantId: "10000100",
    apiKey: "abc123",
    webhookSecret: "sandbox-pass",
    callbackUrl: "https://shop.example/payfast/itn",
  }, {
    orderId: "order_2",
    orderNumber: "9001",
    amount: 12,
    currency: "ZAR",
    returnUrl: "https://shop.example/r?x=1~2",
    cancelUrl: "https://shop.example/c?x=hello world",
    customerEmail: "alice+bob@example.com",
  });

  const url = new URL(initiated.checkoutUrl!);
  const redirectSource = url.search.slice(1).replace(/&signature=.*$/, "");
  const mPaymentId = url.searchParams.get("m_payment_id");
  assert.ok(mPaymentId);

  const expectedFields = {
    merchant_id: "10000100",
    merchant_key: "abc123",
    return_url: "https://shop.example/r?x=1~2",
    cancel_url: "https://shop.example/c?x=hello world",
    notify_url: "https://shop.example/payfast/itn",
    email_address: "alice+bob@example.com",
    m_payment_id: mPaymentId!,
    amount: "12.00",
    item_name: "Order 9001",
    custom_str1: "order_2",
  };

  assert.equal(redirectSource, buildPayfastRedirectSource(expectedFields));
  assert.equal(url.searchParams.get("signature"), buildPayfastSignature(expectedFields, "sandbox-pass"));
});

test("PayFast webhook signature can be reconstructed from final redirect fields", async () => {
  const gateway = new PayfastGateway();
  const initiated = await gateway.initiatePayment({
    mode: "sandbox",
    merchantId: "10000100",
    apiKey: "abc123",
    webhookSecret: "webhook-pass",
  }, {
    orderId: "order_3",
    orderNumber: "2001",
    amount: 49,
    currency: "ZAR",
    returnUrl: "https://shop.example/return",
    cancelUrl: "https://shop.example/cancel",
  });

  const url = new URL(initiated.checkoutUrl!);
  const payload = Object.fromEntries(url.searchParams.entries());
  const rawBody = url.search.slice(1);

  const result = await gateway.verifyWebhook({
    mode: "sandbox",
    merchantId: "10000100",
    apiKey: "abc123",
    webhookSecret: "webhook-pass",
  }, {
    headers: {},
    payload,
    rawBody,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.referenceId, payload.m_payment_id);
});

test("PayFast webhook verification uses raw incoming pair order when available", async () => {
  const gateway = new PayfastGateway();
  const rawBody = [
    "payment_status=COMPLETE",
    "m_payment_id=payfast-order-99",
    "merchant_id=10000100",
    "merchant_key=abc123",
    "amount_gross=49.00",
  ].join("&");
  const signature = crypto.createHash("md5").update(`${rawBody}&passphrase=webhook-pass`).digest("hex");

  const result = await gateway.verifyWebhook({
    mode: "sandbox",
    merchantId: "10000100",
    apiKey: "abc123",
    webhookSecret: "webhook-pass",
  }, {
    headers: {},
    payload: {
      payment_status: "COMPLETE",
      m_payment_id: "payfast-order-99",
      merchant_id: "10000100",
      merchant_key: "abc123",
      amount_gross: "49.00",
      signature,
    },
    rawBody: `${rawBody}&signature=${signature}`,
  });

  assert.equal(result.isValid, true);
  assert.equal(result.status, "PAID");
});
