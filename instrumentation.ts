// Runs once when the Next.js server starts. Validates environment variables so
// a missing or malformed secret stops the server with a clear message instead
// of failing on some later request.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { env } = await import("@/lib/env");
    env();
    await import("@/lib/config");
  }
}
