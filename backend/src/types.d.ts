import "fastify";
import { StaffRole } from "@prisma/client";

declare module "fastify" {
  interface FastifyInstance {
    verifyAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requirePermission: (permission: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      sub: string;
      email: string;
      role: StaffRole;
      permissions: string[];
      iat?: number;
      exp?: number;
    };
  }
}
