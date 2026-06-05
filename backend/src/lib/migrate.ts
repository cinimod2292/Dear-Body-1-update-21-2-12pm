import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma.js";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma/migrations/manual");

export async function runManualMigrations() {
  // Create a tracking table the first time this runs
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_manual_migrations" (
      "name"   TEXT        PRIMARY KEY,
      "run_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const ran = await prisma.$queryRaw<{ name: string }[]>`
    SELECT name FROM "_manual_migrations" ORDER BY name
  `;
  const applied = new Set(ran.map((r) => r.name));

  let files: string[];
  try {
    const entries = await fs.readdir(MIGRATIONS_DIR);
    files = entries.filter((f) => f.endsWith(".sql")).sort();
  } catch {
    // No migrations directory — nothing to do
    return;
  }

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf-8");

    // Strip line comments, split on semicolons, drop BEGIN/COMMIT/empty lines
    const statements = sql
      .split(";")
      .map((s) => s.replace(/--[^\n]*/g, "").trim())
      .filter((s) => s.length > 0 && !/^(BEGIN|COMMIT|ROLLBACK)$/i.test(s));

    console.info(`[migrations] Applying ${file} (${statements.length} statements)`);

    await prisma.$transaction(async (tx) => {
      for (const stmt of statements) {
        await tx.$executeRawUnsafe(stmt);
      }
      await tx.$executeRawUnsafe(
        `INSERT INTO "_manual_migrations" ("name") VALUES ($1)`,
        file,
      );
    });

    console.info(`[migrations] Applied ${file}`);
  }
}
