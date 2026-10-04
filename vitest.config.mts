import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    // Integration tests share one Postgres test database.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, ".") },
  },
});
