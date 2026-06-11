import { FastifyInstance } from "fastify";
import { customerForgotPasswordSchema, customerLoginSchema, customerRefreshSchema, customerRegisterSchema, customerResetPasswordSchema, loginSchema, refreshSchema } from "./auth.schemas.js";
import { createStaffUser, deactivateStaffUser, getCustomerById, listStaffUsers, login, loginCustomer, logoutAdminSession, refreshAdminSession, refreshCustomerSession, registerCustomer, requestCustomerPasswordReset, resetCustomerPassword, updateStaffUser } from "./auth.service.js";
import { env } from "../../config/env.js";

const STRICT_RATE_LIMIT = { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } };
const REGISTER_RATE_LIMIT = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };
const RESET_RATE_LIMIT = { config: { rateLimit: { max: 3, timeWindow: "5 minutes" } } };

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/admin/login", STRICT_RATE_LIMIT, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const tokens = await login(body.email, body.password, app);

    return reply.send({
      data: tokens,
    });
  });

  app.post("/auth/admin/refresh", async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    const tokens = await refreshAdminSession(body.refreshToken, app);

    return reply.send({
      data: tokens,
    });
  });

  app.post("/auth/admin/logout", async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    await logoutAdminSession(body.refreshToken, app);
    return reply.status(204).send();
  });

  app.get("/auth/admin/me", { preHandler: [app.verifyAdmin] }, async (request, reply) => {
    return reply.send({
      data: {
        id: request.user.sub,
        email: request.user.email,
        role: request.user.role,
        permissions: request.user.permissions,
      },
    });
  });

  app.get("/admin/staff-users", { preHandler: [app.verifyAdmin, app.requirePermission("settings:read")] }, async (_request, reply) => {
    return reply.send({ data: await listStaffUsers() });
  });

  app.post("/admin/staff-users", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => {
    return reply.status(201).send({ data: await createStaffUser(request.body as Parameters<typeof createStaffUser>[0]) });
  });

  app.patch("/admin/staff-users/:id", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    return reply.send({ data: await updateStaffUser(id, request.body as Parameters<typeof updateStaffUser>[1]) });
  });

  app.delete("/admin/staff-users/:id", { preHandler: [app.verifyAdmin, app.requirePermission("settings:write")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await deactivateStaffUser(id, request.user.sub);
    return reply.status(204).send();
  });

  app.post("/auth/customer/register", REGISTER_RATE_LIMIT, async (request, reply) => {
    const body = customerRegisterSchema.parse(request.body);
    const session = await registerCustomer(body, app);
    return reply.status(201).send({ data: session });
  });

  app.post("/auth/customer/login", STRICT_RATE_LIMIT, async (request, reply) => {
    const body = customerLoginSchema.parse(request.body);
    const session = await loginCustomer(body.email, body.password, app);
    return reply.send({ data: session });
  });

  app.post("/auth/customer/refresh", async (request, reply) => {
    const body = customerRefreshSchema.parse(request.body);
    const session = await refreshCustomerSession(body.refreshToken, app);
    return reply.send({ data: session });
  });

  app.get("/auth/customer/me", { preHandler: [app.verifyCustomer] }, async (request, reply) => {
    return reply.send({ data: await getCustomerById(request.customer.id) });
  });

  app.post("/auth/customer/forgot-password", RESET_RATE_LIMIT, async (request, reply) => {
    const body = customerForgotPasswordSchema.parse(request.body);
    const siteUrl = env.PUBLIC_BASE_URL || `${request.protocol}://${request.hostname}`;
    await requestCustomerPasswordReset(body.email, siteUrl);
    // Always return 200 to prevent email enumeration
    return reply.send({ data: { message: "If an account exists for that email, a reset link has been sent." } });
  });

  app.post("/auth/customer/reset-password", RESET_RATE_LIMIT, async (request, reply) => {
    const body = customerResetPasswordSchema.parse(request.body);
    await resetCustomerPassword(body.token, body.password);
    return reply.send({ data: { message: "Password updated successfully. You can now log in." } });
  });
}
