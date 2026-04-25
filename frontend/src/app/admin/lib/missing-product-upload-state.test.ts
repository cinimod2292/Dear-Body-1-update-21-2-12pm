import test from "node:test";
import assert from "node:assert/strict";
import { isMissingProductRowBusy, setMissingProductRowState, validateVariantBatchBeforeAttach } from "./missing-product-upload-state";

test("setMissingProductRowState updates one row without affecting other rows", () => {
  const initial = {
    productA: { phase: "uploading" as const, message: "Uploading…" },
    productB: { phase: "idle" as const },
  };

  const next = setMissingProductRowState(initial, "productA", { phase: "processing", message: "Processing images…" });
  assert.equal(next.productA?.phase, "processing");
  assert.equal(next.productB?.phase, "idle");
});

test("row busy helper is scoped per row", () => {
  assert.equal(isMissingProductRowBusy({ phase: "uploading" }), true);
  assert.equal(isMissingProductRowBusy({ phase: "processing" }), true);
  assert.equal(isMissingProductRowBusy({ phase: "attaching" }), true);
  assert.equal(isMissingProductRowBusy({ phase: "error" }), false);
  assert.equal(isMissingProductRowBusy(undefined), false);
});

test("validateVariantBatchBeforeAttach blocks attach when any media optimization fails", () => {
  const ok = validateVariantBatchBeforeAttach([
    { mediaId: "m1", status: "ok", generated: 1, skipped: 0, failed: 0 },
  ]);
  assert.deepEqual(ok, { ok: true });

  const blocked = validateVariantBatchBeforeAttach([
    { mediaId: "m1", status: "ok", generated: 1, skipped: 0, failed: 0 },
    { mediaId: "m2", status: "failed", generated: 0, skipped: 0, failed: 8, error: "failed" },
  ]);
  assert.deepEqual(blocked, { ok: false, message: "failed" });
});
