import { expect, test } from "@playwright/test";
import { ROUTES } from "@/config/routes";
import { E2E_EMAIL, E2E_LOGOUT_EMAIL, E2E_PASSWORD } from "../fixtures/seed-e2e";

// Suite 01 runs with clean (unauthenticated) storageState to avoid invalidating the shared session
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Suite 01: Authentication, Route Guards & Session Lifecycle", () => {
  test.describe("Unauthenticated Route Guards", () => {
    const protectedRoutes = [
      ROUTES.CHATS.path,
      ROUTES.SETTINGS.PROVIDERS.path,
      ROUTES.PROFILE.GENERAL.path,
      ROUTES.WORKFLOWS.TRANSFORM.path,
    ];

    for (const route of protectedRoutes) {
      test(`unauthenticated request to ${route} redirects to /auth/login`, async ({
        page,
      }) => {
        await page.goto(route);
        await page.waitForURL((url) => url.pathname.startsWith("/auth/login"), {
          timeout: 15_000,
        });
        expect(page.url()).toContain("/auth/login");
      });
    }
  });

  test.describe("Login Form Validation & Failure States", () => {
    test("submitting empty form triggers validation constraints", async ({
      page,
    }) => {
      await page.goto("/auth/login");
      const submitButton = page.locator('button[type="submit"]');
      await submitButton.click();

      // Ensure form stays on /auth/login and displays validation state
      expect(page.url()).toContain("/auth/login");
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();
    });

    test("invalid credentials show error feedback", async ({ page }) => {
      await page.goto("/auth/login");
      await page.locator('input[type="email"]').fill("wrong@test.com");
      await page.locator('input[name="password"]').fill("InvalidPassword123!");
      await page.locator('button[type="submit"]').click();

      // Better Auth shows a toast on login error
      const toastOrAlert = page.locator(
        '[data-sonner-toast], [role="alert"], [data-role="alert"]',
      );
      await expect(toastOrAlert.first()).toBeVisible({ timeout: 10_000 });
      expect(page.url()).toContain("/auth/login");
    });
  });

  test.describe("Login Tab Switching & Sub-flows", () => {
    test("switches between Sign In, Sign Up, and Forgot Password", async ({
      page,
    }) => {
      // Mock outbound auth actions that would trigger Postmark
      await page.route("**/api/auth/sign-up/email", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: { id: "mock-user-id", email: "new@test.com" },
          }),
        });
      });
      await page.route("**/api/auth/request-password-reset", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: true }),
        });
      });

      await page.goto("/auth/login");

      // 1. Switch to Sign Up tab
      const signUpTab = page.locator('role=tab[name="Sign Up"]');
      await signUpTab.click();
      await expect(page.locator('input[name="name"]')).toBeVisible();

      // 2. Switch back to Sign In tab
      const signInTab = page.locator('role=tab[name="Sign In"]');
      await signInTab.click();
      await expect(page.locator('input[name="name"]')).not.toBeVisible();

      // 3. Open Forgot Password form
      const forgotPasswordButton = page.locator(
        'button:has-text("Forgot password?")',
      );
      await forgotPasswordButton.click();
      await expect(
        page.locator('button:has-text("Send Reset Email")'),
      ).toBeVisible();

      // 4. Return to Sign In via Back button
      const backButton = page.locator(
        'button:has-text("Back"), button:has-text("Back to Sign In")',
      );
      if (await backButton.isVisible()) {
        await backButton.click();
        await expect(page.locator('role=tab[name="Sign In"]')).toBeVisible();
      }
    });
  });

  test.describe("Auxiliary Auth Pages", () => {
    test("/auth/2fa renders TOTP and Backup code tabs", async ({ page }) => {
      await page.goto("/auth/2fa");
      await expect(
        page.locator("text=Two-Factor Authentication"),
      ).toBeVisible();
      await expect(
        page.locator('role=tab[name*="Authenticator"]'),
      ).toBeVisible();
      await expect(page.locator('role=tab[name*="Backup"]')).toBeVisible();
    });

    test("/auth/reset-password handles missing vs valid tokens", async ({
      page,
    }) => {
      // Missing token renders invalid link notice
      await page.goto("/auth/reset-password");
      await expect(page.locator("text=Invalid Reset Link")).toBeVisible();
      await expect(page.locator("text=Back to Login")).toBeVisible();

      // Valid token param renders password input form
      await page.goto("/auth/reset-password?token=mock-valid-token-12345");
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });
  });

  test.describe("Isolated Sign In and Sign Out Flow", () => {
    test("signs in and then signs out via user menu", async ({ page }) => {
      await page.goto("/auth/login");

      await page.locator('input[type="email"]').fill(E2E_LOGOUT_EMAIL);
      await page.locator('input[name="password"]').fill(E2E_PASSWORD);

      await Promise.all([
        page.waitForResponse(
          (r) =>
            r.url().includes("/api/auth/sign-in/email") && r.status() === 200,
        ),
        page.locator('button[type="submit"]').click(),
      ]);

      await page.waitForURL(
        (url) => url.pathname === "/" || url.pathname === "/chats",
        {
          timeout: 25_000,
        },
      );

      // Open user dropdown menu in sidebar footer
      const userMenuButton = page
        .locator('button:has-text("Logout Test User"), button:has-text("E2E Test User")')
        .first();
      await expect(userMenuButton).toBeVisible();
      await userMenuButton.click();

      // Click Log out
      const logoutItem = page.locator('[role="menuitem"]:has-text("Log out")');
      await expect(logoutItem).toBeVisible();
      await logoutItem.click();

      // Verify redirect to /auth/login
      await page.waitForURL((url) => url.pathname.startsWith("/auth/login"), {
        timeout: 15_000,
      });
      expect(page.url()).toContain("/auth/login");
    });
  });
});
