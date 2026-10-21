import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration for the full-stack AI chat client.
 *
 * Runs against the local Next.js application and the zero-dependency Mock Server
 * (providing OpenAI-compatible SSE endpoints and MCP tools on port 4000).
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e/suites",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  globalSetup: "./e2e/setup/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "setup",
      testDir: "./e2e/setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        trace: "off",
        video: "off",
      },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        storageState: "playwright/.auth/user.json",
      },
      testMatch: /13-settings-and-navigation\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],

  webServer: [
    {
      command: "npx tsx e2e/fixtures/mock-servers.ts",
      url: "http://127.0.0.1:4000/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        RATE_LIMIT_CHAT_RPM: "10000",
        RATE_LIMIT_UPLOAD_RPM: "10000",
        ALLOW_PRIVATE_NETWORK_MCP: "true",
        NEXT_PUBLIC_ALLOW_PRIVATE_NETWORK_MCP: "true",
      },
    },
  ],
});
