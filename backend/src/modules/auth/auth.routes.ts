import { FastifyInstance } from "fastify";
import { loginSchema } from "./auth.schemas.js";
import { login } from "./auth.service.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/admin/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const tokens = await login(body.email, body.password, app);

    return reply.send({
      data: tokens,
    });
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
