import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { StaffUser } from "@prisma/client";
import { getPermissionsForRole } from "./rbac.js";

export async function issueTokens(user: StaffUser, app: any) {
  const permissions = getPermissionsForRole(user.role);

  const accessToken = await app.jwt.sign(
    { email: user.email, role: user.role, permissions },
    { sub: user.id, expiresIn: env.JWT_ACCESS_TTL },
  );

  const refreshToken = await app.jwt.sign(
    { tokenType: "refresh" },
    { sub: user.id, expiresIn: env.JWT_REFRESH_TTL, secret: env.JWT_REFRESH_SECRET },
  );

  const refreshHash = await bcrypt.hash(refreshToken, 10);
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshHash,
      expiresAt: refreshExpiry,
    },
  });

  app.log.info(
    {
      event: "auth.login.token_issued",
      userId: user.id,
      email: user.email,
      accessTokenIssued: Boolean(accessToken),
      accessTokenType: "access",
      accessTokenSecretPath: "env.JWT_ACCESS_SECRET",
      accessTokenExpiresIn: env.JWT_ACCESS_TTL,
      refreshTokenIssued: Boolean(refreshToken),
      refreshTokenType: "refresh",
      refreshTokenSecretPath: "env.JWT_REFRESH_SECRET",
      refreshTokenExpiresIn: env.JWT_REFRESH_TTL,
    },
    "Admin login token issued",
  );

  return { accessToken, refreshToken, permissions };
}

export async function login(email: string, password: string, app: any) {
  const user = await prisma.staffUser.findUnique({ where: { email } });
  if (!user || user.status !== "ACTIVE") {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");
  }

  await prisma.staffUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  return issueTokens(user, app);
}
