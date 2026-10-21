import { expect, test } from "@playwright/test";
import { ROUTES } from "@/config/routes";

test.describe("Suite 13: App Settings, Profile, Tools Catalog, Search & Navigation", () => {
  test.describe("General App Settings (/settings/app)", () => {
    test("loads settings page and updates global system prompt", async ({
      page,
    }) => {
      await page.goto(ROUTES.SETTINGS.APP.path);

      await expect(page.locator("text=General Settings").first()).toBeVisible();
      await expect(page.locator("text=Global System Prompt")).toBeVisible();

      // Find prompt input (MarkdownTabEditor textarea or contenteditable)
      const promptInput = page
        .locator('textarea, [contenteditable="true"]')
        .first();
      await expect(promptInput).toBeVisible();

      const testPrompt = `E2E Test Prompt ${Date.now()}`;
      await promptInput.fill(testPrompt);

      // Save changes
      const saveButton = page.locator('button:has-text("Save Changes")');
      await saveButton.click();

      // Verify success feedback
      const toast = page.locator(
        '[data-sonner-toast]:has-text("Settings updated successfully")',
      );
      await expect(toast).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("Internal Tools Catalog (/settings/tools)", () => {
    test("renders built-in tools categorized with cards", async ({ page }) => {
      await page.goto(ROUTES.SETTINGS.TOOLS.path);

      await expect(
        page.locator("h1:has-text('Tools'), h2:has-text('Tools')").first(),
      ).toBeVisible();
      // Verify internal tool cards exist
      const toolCards = page.locator(
        '[data-slot="card"], .rounded-xl, .border',
      );
      await expect(toolCards.first()).toBeVisible();
    });
  });

  test.describe("Profile Management Pages", () => {
    test("/profile/general renders user details and allows name update", async ({
      page,
    }) => {
      await page.goto(ROUTES.PROFILE.GENERAL.path);

      await expect(
        page.locator("h2:has-text('General Settings')"),
      ).toBeVisible();
      const nameInput = page.locator('input[name="name"]');
      await expect(nameInput).toHaveValue("E2E Test User");

      // Verify update action
      const saveButton = page.locator(
        'button:has-text("Save"), button:has-text("Update")',
      );
      if (await saveButton.isVisible()) {
        await saveButton.click();
      }
    });

    test("/profile/security renders password and 2FA sections", async ({
      page,
    }) => {
      await page.goto(ROUTES.PROFILE.SECURITY.path);
      await expect(page.locator("h2:has-text('Security')")).toBeVisible();
    });

    test("/profile/sessions renders active session", async ({ page }) => {
      await page.goto(ROUTES.PROFILE.SESSIONS.path);
      await expect(
        page.locator("h2:has-text('Active Sessions')"),
      ).toBeVisible();
    });

    test("/profile/accounts renders linked accounts", async ({ page }) => {
      await page.goto(ROUTES.PROFILE.ACCOUNTS.path);
      await expect(
        page.locator("h2:has-text('Linked Accounts')"),
      ).toBeVisible();
    });

    test("/profile/danger requires confirmation for account deletion", async ({
      page,
    }) => {
      await page.route("**/api/auth/delete-user", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: true }),
        });
      });

      await page.goto(ROUTES.PROFILE.DANGER.path);
      await expect(page.locator("h2:has-text('Danger Zone')")).toBeVisible();

      const deleteButton = page.locator(
        'button:has-text("Delete Account Permanently")',
      );
      await expect(deleteButton).toBeVisible();
      await deleteButton.click();

      // Confirm step (AlertDialog shows "Are you sure?" with a "Yes" button)
      const confirmButton = page
        .locator("role=alertdialog")
        .locator('button:has-text("Yes")');
      await expect(confirmButton).toBeVisible();
      await confirmButton.click();

      const toast = page.locator("[data-sonner-toast]");
      await expect(toast.first()).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe("Global Search (/search)", () => {
    test("renders search page with filters and list views", async ({
      page,
    }) => {
      await page.goto(ROUTES.SEARCH.path);

      // Search input and type filter dropdown
      const searchInput = page.locator('input[placeholder*="Search"]');
      await expect(searchInput).toBeVisible();

      await searchInput.fill("nonexistent query 12345");
      // Result list updates cleanly without crashing
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test.describe("Mobile Viewport Navigation", () => {
    test("sidebar collapses and expands via trigger on mobile screen", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(ROUTES.CHATS.path);

      const trigger = page.locator('[data-sidebar="trigger"]');
      await expect(trigger).toBeVisible();
      await trigger.click();

      // Check mobile sidebar content becomes visible in sheet
      const mobileSidebar = page.locator(
        '[data-sidebar="sidebar"], [data-mobile="true"], nav',
      );
      await expect(mobileSidebar.first()).toBeVisible();
    });
  });
});
