import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(".env.local");
} catch {}
// Tests always run against the test database, never DATABASE_URL.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: {
    globalSetup: "./tests/global-setup.ts",
    fileParallelism: false,
  },
});
