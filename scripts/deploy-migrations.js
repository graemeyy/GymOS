// Runs `prisma migrate deploy`. If the target database already has this schema
// from the old `prisma db push` workflow (no migration history yet), the first
// `migrate deploy` fails with P3005 "database schema is not empty" — baseline
// the initial migration as already-applied and retry once, so the switch from
// `db push` to `migrate deploy` doesn't require a manual one-time step against
// production.
const { execSync } = require("child_process");

// Preview deployments (every pull request branch) must not change a database
// that might be shared with production. Only production builds migrate,
// unless the preview environment has its own database and sets
// ALLOW_PREVIEW_MIGRATIONS=true.
if (process.env.VERCEL && process.env.VERCEL_ENV !== "production" && process.env.ALLOW_PREVIEW_MIGRATIONS !== "true") {
  process.stdout.write(`Skipping migrations on a ${process.env.VERCEL_ENV || "non-production"} build. Set ALLOW_PREVIEW_MIGRATIONS=true if this environment has its own database.\n`);
  process.exit(0);
}

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" });
}

try {
  process.stdout.write(run("npx prisma migrate deploy"));
} catch (err) {
  const output = `${err.stdout || ""}${err.stderr || ""}`;
  process.stderr.write(output);

  if (output.includes("P3005")) {
    process.stderr.write(
      "\nDetected pre-existing schema with no migration history — baselining 20250101000000_init.\n"
    );
    process.stdout.write(run("npx prisma migrate resolve --applied 20250101000000_init"));
    process.stdout.write(run("npx prisma migrate deploy"));
  } else {
    process.exit(1);
  }
}
