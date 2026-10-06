// Runs `prisma migrate deploy`: the only way any database gets its schema.
// Nothing here creates or changes tables any other way, and there is no
// automatic baselining (R-68, D-120). A database that already has tables but
// no migration history (P3005) stops the build with instructions, because
// guessing which migrations it already has could skip or repeat one. See
// docs/MERGE-PLAN.md, "Baselining an existing database".
const { execSync } = require("child_process");

// Preview deployments (every pull request branch) must not change a database
// that might be shared with production. Only production builds migrate,
// unless the preview environment has its own database and sets
// ALLOW_PREVIEW_MIGRATIONS=true.
if (process.env.VERCEL && process.env.VERCEL_ENV !== "production" && process.env.ALLOW_PREVIEW_MIGRATIONS !== "true") {
  process.stdout.write(`Skipping migrations on a ${process.env.VERCEL_ENV || "non-production"} build. Set ALLOW_PREVIEW_MIGRATIONS=true if this environment has its own database.\n`);
  process.exit(0);
}

try {
  process.stdout.write(execSync("npx prisma migrate deploy", { encoding: "utf8" }));
} catch (err) {
  const output = `${err.stdout || ""}${err.stderr || ""}`;
  process.stderr.write(output);
  if (output.includes("P3005")) {
    process.stderr.write(
      "\nThis database already has tables but no migration history, so migrations can't be applied safely.\n" +
        "Follow docs/MERGE-PLAN.md, \"Baselining an existing database\", or point DATABASE_URL at an empty database.\n"
    );
  }
  process.exit(1);
}
