import { defineConfig } from "vitest/config";

// Unit tests for pure frontend logic (src/**/*.test.ts). Aliases come from tsconfig.json.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
