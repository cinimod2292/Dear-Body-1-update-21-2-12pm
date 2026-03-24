import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { StaffUser } from "@prisma/client";
import { getPermissionsForRole } from "./rbac.js";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  permissions: string[];
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
}

function getTokenExpiryIso(app: any, token: string): string | null {
  const decoded = app.jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) return null;
  return new Date(decoded.exp * 1000).toISOString();
}

export async function issueTokens(user: StaffUser, app: any): Promise<TokenPair> {
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
  const refreshTokenExpiresAt = getTokenExpiryIso(app, refreshToken);
  const refreshExpiry = refreshTokenExpiresAt ? new Date(refreshTokenExpiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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

  return {
    accessToken,
    refreshToken,
    permissions,
    accessTokenExpiresAt: getTokenExpiryIso(app, accessToken),
    refreshTokenExpiresAt,
  };
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

async function findMatchingRefreshToken(userId: string, refreshToken: string) {
  const candidates = await prisma.refreshToken.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const candidate of candidates) {
    const isMatch = await bcrypt.compare(refreshToken, candidate.tokenHash);
    if (isMatch) return candidate;
  }

  return null;
}

export async function refreshAdminSession(refreshToken: string, app: any): Promise<TokenPair> {
  let decoded: { sub?: string; tokenType?: string } | null = null;

  try {
    decoded = await app.jwt.verify(refreshToken, { secret: env.JWT_REFRESH_SECRET });
  } catch {
    throw new AppError(401, "Invalid refresh token", "UNAUTHORIZED");
  }

  if (!decoded?.sub || decoded.tokenType !== "refresh") {
    throw new AppError(401, "Invalid refresh token", "UNAUTHORIZED");
  }

  const user = await prisma.staffUser.findUnique({ where: { id: decoded.sub } });
  if (!user || user.status !== "ACTIVE") {
    throw new AppError(401, "Invalid refresh token", "UNAUTHORIZED");
  }

  const matchedToken = await findMatchingRefreshToken(user.id, refreshToken);
  if (!matchedToken) {
    throw new AppError(401, "Refresh token revoked or expired", "UNAUTHORIZED");
  }

  await prisma.refreshToken.update({
    where: { id: matchedToken.id },
    data: { revokedAt: new Date() },
  });

  return issueTokens(user, app);
}

export async function logoutAdminSession(refreshToken: string, app: any) {
  let decoded: { sub?: string; tokenType?: string } | null = null;

  try {
    decoded = await app.jwt.verify(refreshToken, { secret: env.JWT_REFRESH_SECRET });
  } catch {
    return;
  }

  if (!decoded?.sub || decoded.tokenType !== "refresh") return;

  const matchedToken = await findMatchingRefreshToken(decoded.sub, refreshToken);
  if (!matchedToken) return;

  await prisma.refreshToken.update({
    where: { id: matchedToken.id },
    data: { revokedAt: new Date() },
  });
}
