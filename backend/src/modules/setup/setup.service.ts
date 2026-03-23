import { spawn } from "node:child_process";
import { env } from "../../config/env.js";
import { seedInitialSuperAdmin } from "../auth/admin-seed.service.js";

export type SetupResult = {
  success: boolean;
  databaseCommand: string;
  databaseOutput: string;
  seed: {
    created: boolean;
    message: string;
  };
};

function runCommand(command: string, args: string[]) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function runPrismaSetup() {
  const migrate = await runCommand("npx", ["prisma", "migrate", "deploy"]);

  if (migrate.code === 0) {
    return {
      command: "npx prisma migrate deploy",
      output: [migrate.stdout, migrate.stderr].filter(Boolean).join("\n").trim(),
    };
  }

  const push = await runCommand("npx", ["prisma", "db", "push"]);

  if (push.code === 0) {
    return {
      command: "npx prisma db push",
      output: [
        "migrate deploy failed; used db push fallback",
        migrate.stdout,
        migrate.stderr,
        push.stdout,
        push.stderr,
      ].filter(Boolean).join("\n").trim(),
    };
  }

  const combinedErrorOutput = [
    "migrate deploy failed",
    migrate.stdout,
    migrate.stderr,
    "db push fallback failed",
    push.stdout,
    push.stderr,
  ].filter(Boolean).join("\n").trim();

  throw new Error(combinedErrorOutput || "Prisma setup commands failed");
}

export async function runInitialSetup(): Promise<SetupResult> {
  if (!env.INITIAL_SUPER_ADMIN_EMAIL || !env.INITIAL_SUPER_ADMIN_PASSWORD) {
    throw new Error("INITIAL_SUPER_ADMIN_EMAIL and INITIAL_SUPER_ADMIN_PASSWORD must be set");
  }

  const database = await runPrismaSetup();
  const seed = await seedInitialSuperAdmin(env.INITIAL_SUPER_ADMIN_EMAIL, env.INITIAL_SUPER_ADMIN_PASSWORD);

  return {
    success: true,
    databaseCommand: database.command,
    databaseOutput: database.output,
    seed,
  };
}
