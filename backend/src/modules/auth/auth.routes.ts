import { FastifyInstance } from "fastify";
import { customerLoginSchema, customerRefreshSchema, customerRegisterSchema, loginSchema, refreshSchema } from "./auth.schemas.js";
import { getCustomerById, login, loginCustomer, logoutAdminSession, refreshAdminSession, refreshCustomerSession, registerCustomer } from "./auth.service.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/admin/login", async (request, reply) => {
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

  app.post("/auth/customer/register", async (request, reply) => {
    const body = customerRegisterSchema.parse(request.body);
    const session = await registerCustomer(body, app);
    return reply.status(201).send({ data: session });
  });

  app.post("/auth/customer/login", async (request, reply) => {
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
}
