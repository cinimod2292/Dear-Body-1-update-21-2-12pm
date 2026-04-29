import test from "node:test";
import assert from "node:assert/strict";
import { registerErrorHandler } from "./errors.js";

test("oversized upload errors return 413 JSON message", () => {
  let handler: any = null;
  const app = {
    setErrorHandler(fn: any) {
      handler = fn;
    },
  };
  registerErrorHandler(app as any);
  const request = { id: "req_1", log: { error: () => undefined } } as any;
  let statusCode = 0;
  let payload: any = null;
  const reply = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    send(body: any) {
      payload = body;
      return this;
    },
  } as any;

  handler({ statusCode: 413, code: "FST_REQ_FILE_TOO_LARGE", message: "too large" }, request, reply);
  assert.equal(statusCode, 413);
  assert.equal(payload.error, "Hero image is too large. Max size is 15 MB.");
});
