import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { hasPermission } from "../modules/auth/rbac.js";

export const authPlugin = fp(async (app) => {
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  app.decorate("verifyAdmin", async (request: any, _reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, "Unauthorized", "UNAUTHORIZED");
    }
  });

  app.decorate("requirePermission", (permission: string) => async (request: any, _reply: any) => {
    const role = request.user?.role;
    if (!role || !hasPermission(role, permission)) {
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
  });

  app.decorate("hashPassword", async (plain: string) => bcrypt.hash(plain, 12));
  app.decorate("comparePassword", async (plain: string, hash: string) => bcrypt.compare(plain, hash));
});
