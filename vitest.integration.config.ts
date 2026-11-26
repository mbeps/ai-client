import react from "@vitejs/plugin-react";
import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    name: "integration",
    environment: "node",
    globals: true,
    setupFiles: ["./vitest.setup.node.ts"],
    include: ["__tests__/integration/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
