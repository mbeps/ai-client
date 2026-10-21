import fs from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "../fixtures/seed-e2e";

const authFile = path.resolve(__dirname, "../../playwright/.auth/user.json");

setup("authenticate as e2e user", async ({ page }) => {
  setup.setTimeout(60_000);

  // Ensure destination directory exists
  const authDir = path.dirname(authFile);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  await page.goto("/auth/login");

  // Fill credentials
  await page.locator('input[type="email"]').fill(E2E_EMAIL);
  await page.locator('input[name="password"]').fill(E2E_PASSWORD);

  const [signInResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/auth/sign-in/email") && r.status() === 200,
    ),
    page.locator('button[type="submit"]').click(),
  ]);

  expect(signInResponse.ok()).toBeTruthy();

  // Wait for client-side navigation or proxy redirect to dashboard
  await page.waitForURL(
    (url) => url.pathname === "/" || url.pathname === "/chats",
    {
      timeout: 30_000,
    },
  );

  // Verify dashboard / authenticated body is present
  await expect(page.locator("body")).toBeVisible();

  // Pre-warm /chats route compilation
  await page.goto("/chats");
  await expect(page.locator("body")).toBeVisible();

  // Persist storage state
  await page.context().storageState({ path: authFile });
  console.log(`✅ Auth storageState persisted to ${authFile}`);
});
