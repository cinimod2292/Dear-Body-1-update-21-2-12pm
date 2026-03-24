import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { hasPermission } from "../modules/auth/rbac.js";
import { prisma } from "../lib/prisma.js";

export const authPlugin = fp(async (app) => {
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
  });

  app.decorate("verifyAdmin", async (request: any, _reply: any) => {
    const authContext = {
      method: request.method,
      url: request.url,
      hasAuthorizationHeader: Boolean(request.headers.authorization),
      jwtVerificationSucceeded: false,
      tokenSub: undefined as string | undefined,
      tokenEmail: undefined as string | undefined,
      tokenRole: undefined as string | undefined,
      staffLookupSucceeded: false,
      statusCheckFailed: false,
    };

    try {
      await request.jwtVerify();
      authContext.jwtVerificationSucceeded = true;
      authContext.tokenSub = request.user?.sub;
      authContext.tokenEmail = request.user?.email;
      authContext.tokenRole = request.user?.role;
    } catch {
      request.log.warn(authContext, "Admin auth failed: JWT verification failed");
      throw new AppError(401, "Unauthorized", "UNAUTHORIZED");
    }

    const staffUser = await prisma.staffUser.findUnique({
      where: { id: request.user.sub },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!staffUser) {
      request.log.warn(authContext, "Admin auth failed: staff user lookup failed");
      throw new AppError(401, "Unauthorized", "UNAUTHORIZED");
    }

    authContext.staffLookupSucceeded = true;

    if (staffUser.status !== "ACTIVE") {
      authContext.statusCheckFailed = true;
      request.log.warn(
        { ...authContext, staffStatus: staffUser.status },
        "Admin auth failed: staff status is not ACTIVE",
      );
      throw new AppError(401, "Unauthorized", "UNAUTHORIZED");
    }

    if (staffUser.email !== request.user.email || staffUser.role !== request.user.role) {
      request.log.warn(
        {
          ...authContext,
          staffEmail: staffUser.email,
          staffRole: staffUser.role,
        },
        "Admin auth failed: token claims mismatch staff record",
      );
      throw new AppError(401, "Unauthorized", "UNAUTHORIZED");
    }
  });

  app.decorate("requirePermission", (permission: string) => async (request: any, _reply: any) => {
    const role = request.user?.role;
    if (!role || !hasPermission(role, permission)) {
      request.log.warn(
        {
          method: request.method,
          url: request.url,
          tokenSub: request.user?.sub,
          tokenEmail: request.user?.email,
          tokenRole: role,
          requiredPermission: permission,
          permissionCheckFailed: true,
        },
        "Admin auth failed: permission check failed",
      );
      throw new AppError(403, "Forbidden", "FORBIDDEN");
    }
  });

  app.decorate("hashPassword", async (plain: string) => bcrypt.hash(plain, 12));
  app.decorate("comparePassword", async (plain: string, hash: string) => bcrypt.compare(plain, hash));
});
