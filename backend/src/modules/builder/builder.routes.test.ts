import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { builderRoutes } from "./builder.routes.js";

test("hero upload route is registered (not 404)", async () => {
  const app = Fastify();
  await app.register(multipart);
  (app as any).decorate("verifyAdmin", async () => undefined);
  (app as any).decorate("requirePermission", () => async () => undefined);
  await app.register(async (api) => {
    await api.register(builderRoutes);
  }, { prefix: "/api" });

  const response = await app.inject({
    method: "POST",
    url: "/api/admin/builder/home/hero-image",
  });

  assert.notEqual(response.statusCode, 404);
  await app.close();
});
