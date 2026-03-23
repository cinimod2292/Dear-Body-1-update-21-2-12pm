import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";

async function main() {
  if (!env.INITIAL_SUPER_ADMIN_EMAIL || !env.INITIAL_SUPER_ADMIN_PASSWORD) {
    throw new Error("INITIAL_SUPER_ADMIN_EMAIL and INITIAL_SUPER_ADMIN_PASSWORD must be set for seed script");
  }

  const existing = await prisma.staffUser.findUnique({ where: { email: env.INITIAL_SUPER_ADMIN_EMAIL } });
  if (existing) {
    console.log("Initial super admin already exists");
    return;
  }

  const hash = await bcrypt.hash(env.INITIAL_SUPER_ADMIN_PASSWORD, 12);

  await prisma.staffUser.create({
    data: {
      email: env.INITIAL_SUPER_ADMIN_EMAIL,
      passwordHash: hash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log("Initial super admin created");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
