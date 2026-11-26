import react from "@vitejs/plugin-react";
import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const sharedPlugins = [react(), tsconfigPaths()];
const sharedAlias = {
  "@": path.resolve(__dirname, "."),
};

export default defineConfig({
  plugins: sharedPlugins,
  resolve: {
    alias: sharedAlias,
  },
  test: {
    globals: true,
    reportsDirectory: "./coverage",
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          setupFiles: ["./vitest.setup.node.ts"],
          include: [
            "__tests__/actions/**/*.test.ts",
            "__tests__/app/api/**/*.test.ts",
            "__tests__/architecture/**/*.test.ts",
            "__tests__/config/**/*.test.ts",
            "__tests__/drizzle/**/*.test.ts",
            "__tests__/lib/**/*.test.ts",
            "__tests__/schemas/**/*.test.ts",
            "__tests__/proxy.test.ts",
            "__tests__/next.config.test.ts",
            "__tests__/instrumentation.test.ts",
          ],
          exclude: ["**/node_modules/**", "**/.next/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: [
            "__tests__/components/**/*.test.{ts,tsx}",
            "__tests__/hooks/**/*.test.{ts,tsx}",
            "__tests__/app/**/*.test.tsx",
            "__tests__/lib/**/*.test.tsx",
          ],
          exclude: ["**/node_modules/**", "**/.next/**"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      all: true,
      reporter: ["text", "lcov", "json"],
      reportsDirectory: "coverage",
      include: [
        "actions/**/*.{ts,tsx}",
        "app/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "config/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "lib/**/*.{ts,tsx}",
        "schemas/**/*.{ts,tsx}",
        "proxy.ts",
        "instrumentation.ts",
      ],
      exclude: [
        "drizzle/**",
        "**/node_modules/**",
        "**/.next/**",
        "types/**",
        "scripts/**",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
