import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { seedInitialSuperAdmin } from "../modules/auth/admin-seed.service.js";

async function main() {
  if (!env.INITIAL_SUPER_ADMIN_EMAIL || !env.INITIAL_SUPER_ADMIN_PASSWORD) {
    throw new Error("INITIAL_SUPER_ADMIN_EMAIL and INITIAL_SUPER_ADMIN_PASSWORD must be set for seed script");
  }

  const result = await seedInitialSuperAdmin(env.INITIAL_SUPER_ADMIN_EMAIL, env.INITIAL_SUPER_ADMIN_PASSWORD);
  console.log(result.message);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
