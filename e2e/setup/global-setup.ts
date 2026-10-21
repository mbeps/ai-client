import { seedE2eDatabase } from "../fixtures/seed-e2e";

/**
 * Global setup executed once before all Playwright test workers run.
 * Seeds a clean, deterministic state for the `e2e@test.com` test user.
 */
export default async function globalSetup() {
  console.log("⚡ Executing Playwright globalSetup...");
  await seedE2eDatabase();
}
