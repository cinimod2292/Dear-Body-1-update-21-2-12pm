import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma.js";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "prisma/migrations/manual");

/**
 * Splits a SQL file into individual statements, correctly handling:
 *   - Dollar-quoted blocks: DO $$ ... END $$;  or  $body$ ... $body$
 *   - Single-quoted string literals (with '' escapes)
 *   - Line comments  (--)
 *   - Block comments (/ * ... * /)
 * None of those may contain a `;` that counts as a statement terminator.
 */
function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let i = 0;

  while (i < sql.length) {
    // Line comment — consume to end of line
    if (sql[i] === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      if (end === -1) break;
      i = end + 1;
      continue;
    }

    // Block comment — consume to */
    if (sql[i] === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }

    // Dollar-quoted string: $$...$$ or $tag$...$tag$
    if (sql[i] === "$") {
      const tagMatch = sql.slice(i).match(/^\$([A-Za-z_0-9]*)\$/);
      if (tagMatch) {
        const tag = tagMatch[0];
        const closePos = sql.indexOf(tag, i + tag.length);
        if (closePos !== -1) {
          current += sql.slice(i, closePos + tag.length);
          i = closePos + tag.length;
          continue;
        }
      }
    }

    // Single-quoted string literal
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; }
        else if (sql[j] === "'") { j++; break; }
        else { j++; }
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // Statement terminator
    if (sql[i] === ";") {
      const stmt = current.trim();
      if (stmt.length > 0 && !/^(BEGIN|COMMIT|ROLLBACK)$/i.test(stmt)) {
        statements.push(stmt);
      }
      current = "";
      i++;
      continue;
    }

    current += sql[i];
    i++;
  }

  // Trailing statement with no closing semicolon
  const trailing = current.trim();
  if (trailing.length > 0 && !/^(BEGIN|COMMIT|ROLLBACK)$/i.test(trailing)) {
    statements.push(trailing);
  }

  return statements;
}

export async function runManualMigrations() {
  // Create tracking table on first run
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
    return;
  }

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf-8");
    const statements = splitStatements(sql);

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
