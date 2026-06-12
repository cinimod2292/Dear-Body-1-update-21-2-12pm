import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { Customer, StaffRole, StaffStatus, StaffUser } from "@prisma/client";
import { getPermissionsForRole } from "./rbac.js";
import { sendEmail } from "../notifications/notification.service.js";
import { resolveTemplateByKey } from "../email-templates/email-template.service.js";

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


interface CustomerToken {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  customer: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  };
}

async function issueCustomerAccessToken(customer: Customer, app: any): Promise<CustomerToken> {
  const accessToken = await app.jwt.sign(
    { email: customer.email, tokenType: "customer" },
    { sub: customer.id, expiresIn: env.JWT_ACCESS_TTL },
  );

  const refreshToken = await app.jwt.sign(
    { tokenType: "customer_refresh" },
    { sub: customer.id, expiresIn: env.JWT_REFRESH_TTL, secret: env.JWT_REFRESH_SECRET },
  );

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: getTokenExpiryIso(app, accessToken),
    refreshTokenExpiresAt: getTokenExpiryIso(app, refreshToken),
    customer: {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
    },
  };
}

export async function registerCustomer(input: { email: string; password: string; firstName?: string; lastName?: string; phone?: string }, app: any) {
  const existing = await prisma.customer.findUnique({ where: { email: input.email } });
  if (existing?.passwordHash) throw new AppError(409, "Customer account already exists", "CUSTOMER_EXISTS");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const customer = existing
    ? await prisma.customer.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          status: "ACTIVE",
          firstName: input.firstName ?? existing.firstName,
          lastName: input.lastName ?? existing.lastName,
          phone: input.phone ?? existing.phone,
        },
      })
    : await prisma.customer.create({
        data: {
          email: input.email,
          passwordHash,
          status: "ACTIVE",
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
        },
      });

  const tokens = await issueCustomerAccessToken(customer, app);

  resolveTemplateByKey("welcome_email", {
    firstName: customer.firstName ?? "there",
    siteUrl: env.STOREFRONT_URL ?? "",
  }).then((template) =>
    sendEmail({ to: customer.email, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key, customerId: customer.id } })
  ).catch((err) => app.log.warn({ err, customerId: customer.id }, "Welcome email failed to send"));

  return tokens;
}

export async function loginCustomer(email: string, password: string, app: any) {
  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer?.passwordHash) throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");

  const valid = await bcrypt.compare(password, customer.passwordHash);
  if (!valid) throw new AppError(401, "Invalid credentials", "INVALID_CREDENTIALS");

  return issueCustomerAccessToken(customer, app);
}

export async function refreshCustomerSession(refreshToken: string, app: any) {
  let decoded: { sub?: string; tokenType?: string } | null = null;

  try {
    decoded = await app.jwt.verify(refreshToken, { secret: env.JWT_REFRESH_SECRET });
  } catch {
    throw new AppError(401, "Invalid refresh token", "UNAUTHORIZED");
  }

  if (!decoded?.sub || decoded.tokenType !== "customer_refresh") {
    throw new AppError(401, "Invalid refresh token", "UNAUTHORIZED");
  }

  const customer = await prisma.customer.findUnique({ where: { id: decoded.sub } });
  if (!customer?.passwordHash) {
    throw new AppError(401, "Invalid refresh token", "UNAUTHORIZED");
  }

  return issueCustomerAccessToken(customer, app);
}

export async function getCustomerById(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true },
  });
  if (!customer) throw new AppError(404, "Customer not found", "CUSTOMER_NOT_FOUND");
  return customer;
}

const RESET_TOKEN_TTL_MINUTES = 60;

export async function requestCustomerPasswordReset(email: string, siteUrl: string) {
  const customer = await prisma.customer.findUnique({ where: { email } });

  // Always respond with success to prevent email enumeration
  if (!customer?.passwordHash) return;

  // Invalidate any existing unused tokens
  await prisma.customerPasswordReset.updateMany({
    where: { customerId: customer.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(rawToken, 10);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.customerPasswordReset.create({
    data: { customerId: customer.id, tokenHash, expiresAt },
  });

  const resetUrl = `${siteUrl}/account/reset-password?token=${rawToken}`;

  const template = await resolveTemplateByKey("password_reset", {
    resetUrl,
    siteUrl,
    supportEmail: env.EMAIL_FROM,
  });

  await sendEmail({ to: customer.email, subject: template.subject, html: template.htmlBody, meta: { templateKey: template.key } });
}

export async function listStaffUsers() {
  return prisma.staffUser.findMany({
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function verifyAdminPassword(userId: string, password: string): Promise<void> {
  const user = await prisma.staffUser.findUnique({ where: { id: userId }, select: { passwordHash: true, status: true } });
  if (!user || user.status !== "ACTIVE") throw new AppError(403, "Invalid credentials", "INVALID_CREDENTIALS");
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError(403, "Invalid password", "INVALID_CREDENTIALS");
}

export async function createStaffUser(data: { email: string; password: string; firstName?: string; lastName?: string; role?: string }) {
  const existing = await prisma.staffUser.findUnique({ where: { email: data.email } });
  if (existing) throw new AppError(409, "A user with that email already exists", "STAFF_USER_EXISTS");

  const passwordHash = await bcrypt.hash(data.password, 12);
  return prisma.staffUser.create({
    data: {
      email: data.email,
      passwordHash,
      firstName: data.firstName || undefined,
      lastName: data.lastName || undefined,
      role: (data.role as StaffRole) ?? StaffRole.STORE_MANAGER,
      status: StaffStatus.ACTIVE,
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
  });
}

export async function updateStaffUser(id: string, data: { firstName?: string; lastName?: string; role?: string; status?: string }) {
  const user = await prisma.staffUser.findUnique({ where: { id } });
  if (!user) throw new AppError(404, "Staff user not found", "STAFF_USER_NOT_FOUND");

  return prisma.staffUser.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined ? { firstName: data.firstName || null } : {}),
      ...(data.lastName !== undefined ? { lastName: data.lastName || null } : {}),
      ...(data.role ? { role: data.role as StaffRole } : {}),
      ...(data.status ? { status: data.status as StaffStatus } : {}),
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, status: true, createdAt: true },
  });
}

export async function deactivateStaffUser(id: string, requestingUserId: string) {
  if (id === requestingUserId) throw new AppError(400, "You cannot suspend your own account", "CANNOT_DEACTIVATE_SELF");

  const user = await prisma.staffUser.findUnique({ where: { id } });
  if (!user) throw new AppError(404, "Staff user not found", "STAFF_USER_NOT_FOUND");

  return prisma.staffUser.update({
    where: { id },
    data: { status: StaffStatus.SUSPENDED },
    select: { id: true, email: true, status: true },
  });
}

export async function resetCustomerPassword(rawToken: string, newPassword: string) {
  // Find all unexpired, unused reset records
  const candidates = await prisma.customerPasswordReset.findMany({
    where: {
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  let matched: (typeof candidates)[number] | null = null;
  for (const candidate of candidates) {
    const isMatch = await bcrypt.compare(rawToken, candidate.tokenHash);
    if (isMatch) { matched = candidate; break; }
  }

  if (!matched) {
    throw new AppError(400, "This reset link is invalid or has expired. Please request a new one.", "INVALID_RESET_TOKEN");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: matched.customerId },
      data: { passwordHash, status: "ACTIVE" },
    }),
    prisma.customerPasswordReset.update({
      where: { id: matched.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
