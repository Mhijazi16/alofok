import { defineConfig } from "vitest/config";
import path from "path";

// Standalone Vitest config: reuses the same `@` -> ./src alias as vite.config.ts
// but skips the app plugins (React/PWA) that aren't needed for pure unit tests.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
