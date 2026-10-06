import { readdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { checkConfig, checkDatabase, checkEnvironment, checkSetupToken, formatFindings, type Finding } from "../lib/setup/checks";

// npm run check:setup [-- --no-db]
//
// Checks that this copy of GymOS is fully set up for a gym (D-132): its
// environment variables, config/gym.config.json, and (unless --no-db) what's
// in its database. Reads .env if present; on a deployment, run it with the
// deployment's variables (see docs/NEW-GYM-SETUP.md). Reports what's missing.
// It never prints a value: secrets, connection strings and keys are only
// checked for presence and shape. The database is only read.

const skipDb = process.argv.includes("--no-db");

async function main() {
  const findings: Finding[] = checkEnvironment(process.env);

  try {
    const { gym } = await import("../lib/config");
    findings.push(...checkConfig(gym));
  } catch (error) {
    findings.push({ level: "fail", area: "Gym details", message: `config/gym.config.json isn't valid. Run npm run check:config for details.${error instanceof Error && error.message.length < 300 ? ` (${error.message.split("\n")[0]})` : ""}` });
  }

  let hasOwner: boolean | null = null;
  if (skipDb) {
    findings.push({ level: "note", area: "Database", message: "Skipped the database checks (--no-db)." });
  } else if (process.env.DATABASE_URL) {
    const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL, log: [] });
    try {
      const migrations = readdirSync("prisma/migrations").filter((n) => /^\d{14}_/.test(n)).sort();
      const result = await checkDatabase(prisma, migrations);
      findings.push(...result.findings);
      hasOwner = result.hasOwner;
    } catch (error) {
      // The error can include the host name, so only its code is shown.
      const e = error as { errorCode?: string; code?: string; name?: string };
      const code = e.errorCode ?? e.code ?? e.name ?? "unknown";
      const unreachable = code === "P1001" || code === "PrismaClientInitializationError";
      findings.push({ level: "fail", area: "Database", message: unreachable ? `Couldn't connect to the database (${code}). Check DATABASE_URL and that the database accepts connections from here.` : `Couldn't read the database (${code}). Check that the migrations have run.` });
    } finally {
      await prisma.$disconnect();
    }
  }
  findings.push(...checkSetupToken(process.env, hasOwner));

  console.info("GymOS setup check\n");
  console.info(formatFindings(findings));
  const failed = findings.filter((f) => f.level === "fail").length;
  const warned = findings.filter((f) => f.level === "warn").length;
  console.info(failed ? `\n${failed} thing(s) to fix${warned ? `, ${warned} to look at` : ""}. See docs/NEW-GYM-SETUP.md.` : warned ? `\nReady, with ${warned} thing(s) to look at.` : "\nReady.");
  process.exit(failed ? 1 : 0);
}

void main();
