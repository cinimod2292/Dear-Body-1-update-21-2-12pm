import { spawn } from "node:child_process";
import { env } from "../../config/env.js";
import { seedInitialSuperAdmin } from "../auth/admin-seed.service.js";

const COMMAND_TIMEOUT_MS = 60_000;

type SetupStepName = "migrateDeploy" | "dbPush" | "seed";

export type SetupStepProgress = {
  step: SetupStepName;
  startedAt: string;
  completedAt?: string;
  status: "success" | "failed";
  command?: string;
  output?: string;
  error?: string;
};

export type SetupResult = {
  success: boolean;
  databaseCommand: string;
  databaseOutput: string;
  steps: SetupStepProgress[];
  seed: {
    created: boolean;
    message: string;
  };
};

export class SetupExecutionError extends Error {
  constructor(
    message: string,
    public readonly steps: SetupStepProgress[],
  ) {
    super(message);
    this.name = "SetupExecutionError";
  }
}

function runCommand(command: string, args: string[], timeoutMs: number = COMMAND_TIMEOUT_MS) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    let didTimeout = false;
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

    const timeoutHandle = setTimeout(() => {
      didTimeout = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutHandle);
      if (didTimeout) {
        reject(
          new Error(
            `Command timed out after ${timeoutMs}ms: ${[command, ...args].join(" ")}`,
          ),
        );
        return;
      }
      resolve({ code, stdout, stderr });
    });
  });
}

function commandOutput(stdout: string, stderr: string) {
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

async function runPrismaSetup(steps: SetupStepProgress[]) {
  const migrateStep: SetupStepProgress = {
    step: "migrateDeploy",
    startedAt: new Date().toISOString(),
    status: "failed",
    command: "npx --no-install prisma migrate deploy",
  };
  steps.push(migrateStep);

  console.info("[setup] migrate deploy start");
  const migrate = await runCommand("npx", ["--no-install", "prisma", "migrate", "deploy"]);
  migrateStep.completedAt = new Date().toISOString();
  migrateStep.output = commandOutput(migrate.stdout, migrate.stderr);

  if (migrate.code === 0) {
    migrateStep.status = "success";
    console.info("[setup] migrate deploy end");
    return {
      command: "npx --no-install prisma migrate deploy",
      output: migrateStep.output,
    };
  }

  migrateStep.error = `Exited with code ${String(migrate.code)}`;
  console.info("[setup] migrate deploy end (failed)");

  const pushStep: SetupStepProgress = {
    step: "dbPush",
    startedAt: new Date().toISOString(),
    status: "failed",
    command: "npx --no-install prisma db push --accept-data-loss",
  };
  steps.push(pushStep);

  console.info("[setup] db push start");
  const push = await runCommand("npx", [
    "--no-install",
    "prisma",
    "db",
    "push",
    "--accept-data-loss",
  ]);
  pushStep.completedAt = new Date().toISOString();
  pushStep.output = commandOutput(push.stdout, push.stderr);

  if (push.code === 0) {
    pushStep.status = "success";
    console.info("[setup] db push end");
    return {
      command: "npx --no-install prisma db push --accept-data-loss",
      output: [
        "migrate deploy failed; used db push fallback",
        migrateStep.output,
        pushStep.output,
      ].filter(Boolean).join("\n").trim(),
    };
  }

  pushStep.error = `Exited with code ${String(push.code)}`;
  console.info("[setup] db push end (failed)");

  const combinedErrorOutput = [
    "migrate deploy failed",
    migrateStep.output,
    "db push fallback failed",
    pushStep.output,
  ].filter(Boolean).join("\n").trim();

  throw new SetupExecutionError(combinedErrorOutput || "Prisma setup commands failed", steps);
}

export async function runInitialSetup(): Promise<SetupResult> {
  if (!env.INITIAL_SUPER_ADMIN_EMAIL || !env.INITIAL_SUPER_ADMIN_PASSWORD) {
    throw new Error("INITIAL_SUPER_ADMIN_EMAIL and INITIAL_SUPER_ADMIN_PASSWORD must be set");
  }

  const steps: SetupStepProgress[] = [];
  let database: { command: string; output: string };

  try {
    database = await runPrismaSetup(steps);
  } catch (error) {
    if (error instanceof SetupExecutionError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown Prisma setup failure";
    throw new SetupExecutionError(message, steps);
  }

  const seedStep: SetupStepProgress = {
    step: "seed",
    startedAt: new Date().toISOString(),
    status: "failed",
  };
  steps.push(seedStep);
  console.info("[setup] seed start");

  let seed;
  try {
    seed = await seedInitialSuperAdmin(env.INITIAL_SUPER_ADMIN_EMAIL, env.INITIAL_SUPER_ADMIN_PASSWORD);
    seedStep.completedAt = new Date().toISOString();
    seedStep.status = "success";
    seedStep.output = seed.message;
    console.info("[setup] seed end");
  } catch (error) {
    seedStep.completedAt = new Date().toISOString();
    seedStep.error = error instanceof Error ? error.message : "Unknown seed failure";
    console.info("[setup] seed end (failed)");
    throw new SetupExecutionError(seedStep.error, steps);
  }

  return {
    success: true,
    databaseCommand: database.command,
    databaseOutput: database.output,
    steps,
    seed,
  };
}
