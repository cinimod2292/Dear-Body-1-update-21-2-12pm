import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";

export async function seedInitialSuperAdmin(email: string, password: string) {
  const existing = await prisma.staffUser.findUnique({ where: { email } });

  if (existing) {
    return {
      created: false,
      message: "Initial super admin already exists",
    };
  }

  const hash = await bcrypt.hash(password, 12);

  await prisma.staffUser.create({
    data: {
      email,
      passwordHash: hash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  return {
    created: true,
    message: "Initial super admin created",
  };
}
