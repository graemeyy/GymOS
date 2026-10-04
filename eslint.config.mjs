import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// Client components ("use client") run in the browser, so they must not
// import server modules: the database, secrets, the route wrappers, or the
// Zod-validated config (the browser uses lib/config/client.ts). Type-only
// imports are fine. lib/db.ts and lib/env.ts also import "server-only", which
// catches indirect imports at build time.
const SERVER_MODULES = ["@/lib/db", "@/lib/env", "@/lib/config", "@/lib/http/route", "@prisma/client"];
const gymos = {
  rules: {
    "no-server-imports-in-client": {
      meta: { type: "problem", schema: [], messages: { server: "Client components can't import {{name}}. Use an API route, or lib/config/client for the gym config." } },
      create(context) {
        let isClient = false;
        return {
          Program(node) {
            // Shared components and browser helpers end up in client bundles
            // even without the directive, when a client component imports them.
            const shared = /[\\/](components|lib[\\/]client)[\\/]/.test(context.filename);
            isClient = shared || node.body.some((s) => s.type === "ExpressionStatement" && s.directive === "use client");
          },
          ImportDeclaration(node) {
            if (!isClient || node.importKind === "type") return;
            if (node.specifiers.length > 0 && node.specifiers.every((s) => s.importKind === "type")) return;
            if (SERVER_MODULES.includes(node.source.value)) context.report({ node, messageId: "server", data: { name: node.source.value } });
          },
        };
      },
    },
  },
};

const config = [
  { ignores: [".claude/**", ".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "coverage/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: { gymos },
    rules: {
      "gymos/no-server-imports-in-client": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    files: ["scripts/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
];

export default config;
