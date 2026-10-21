import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 06: Projects CRUD, Scoped Chat & 404 Boundary", () => {
  test("creates project, chats in project context, deletes project, and verifies 404", async ({
    page,
    sendChatMessage,
    waitForStreamComplete,
    uniqueName,
  }) => {
    test.setTimeout(90_000);
    const projectName = uniqueName("QA-Project");

    // 1. Navigate to projects list
    await page.goto(ROUTES.PROJECTS.path);
    await expect(page.locator("h1:has-text('Projects')")).toBeVisible();

    // 2. Open New Project dialog
    await page.locator('button:has-text("New Project")').click();
    await expect(page.locator('h2:has-text("New Project")')).toBeVisible();

    // 3. Fill and submit project form
    await page.locator('input[placeholder="My Project"]').fill(projectName);
    await page
      .locator('button[type="submit"]:has-text("Create Project")')
      .click();

    // 4. Verify project card appears in the list
    const projectCard = page
      .locator(`[data-slot="card"]:has-text("${projectName}")`)
      .first();
    await expect(projectCard).toBeVisible({ timeout: 15_000 });

    // 5. Navigate to Project detail page
    await projectCard.click();
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith(ROUTES.PROJECTS.path) &&
        url.pathname !== ROUTES.PROJECTS.path,
    );
    await expect(page.getByRole("heading", { name: projectName })).toBeVisible({
      timeout: 10_000,
    });

    // 6. Start chat with project
    const chatBtn = page.locator('main button:has-text("New Chat")').first();
    await expect(chatBtn).toBeVisible();
    await chatBtn.click();
    await page.waitForURL(
      (url) =>
        url.pathname.includes("/projects/") &&
        url.pathname.split("/").length >= 4,
      {
        timeout: 35_000,
      },
    );

    // 7. Send message in project-scoped chat
    await sendChatMessage(page, "Hello Project Workspace!");
    await waitForStreamComplete(page);
    await expect(page.locator("table").first()).toBeVisible({
      timeout: 10_000,
    });

    // 8. Navigate back to Project detail page and switch to danger tab
    const pathSegments = new URL(page.url()).pathname.split("/");
    const projectId = pathSegments[2];
    await page.goto(ROUTES.PROJECTS.detail(projectId));
    await page.locator('button[role="tab"]:has-text("Danger Zone")').click();

    // 9. Delete Project via DangerZoneCard
    const deleteBtn = page.locator('button:has-text("Delete Project")').first();
    await expect(deleteBtn).toBeVisible({ timeout: 15_000 });
    await deleteBtn.click();

    // 10. Confirm deletion in dialog
    const confirmBtn = page.locator('button:has-text("Delete")').last();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 11. Verify redirected to projects list and project is deleted
    await page.waitForURL(ROUTES.PROJECTS.path, { timeout: 15_000 });
    await expect(
      page.locator(`[data-slot="card"]:has-text("${projectName}")`),
    ).not.toBeVisible();

    // 12. Verify 404 boundary on nonexistent project
    await page.goto(
      ROUTES.PROJECTS.detail("00000000-0000-4000-a000-000000000000"),
    );
    await expect(page.locator("body")).toBeVisible();
    const notFoundIndicator = page.locator(
      ':is(:text("404"), :text("Not Found"), :text("not found"))',
    );
    await expect(notFoundIndicator.first()).toBeVisible({ timeout: 25_000 });
  });
});
