import { FastifyInstance } from "fastify";
import { loginSchema, refreshSchema } from "./auth.schemas.js";
import { login, logoutAdminSession, refreshAdminSession } from "./auth.service.js";

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
}
