import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 05: Assistants CRUD, Scoped Chat & 404 Boundary", () => {
  test("creates assistant, chats in assistant context, deletes assistant, and verifies 404", async ({
    page,
    sendChatMessage,
    waitForStreamComplete,
    uniqueName,
  }) => {
    test.setTimeout(90_000);
    const assistantName = uniqueName("QA-Assistant");
    const assistantDesc = "Dedicated assistant for automated E2E validation.";

    // 1. Navigate to assistants list
    await page.goto(ROUTES.ASSISTANTS.path);
    await expect(page.locator("h1:has-text('Assistants')")).toBeVisible();

    // 2. Open Create Assistant dialog
    await page.locator('button:has-text("Create Assistant")').click();
    await expect(page.locator('h2:has-text("Create Assistant")')).toBeVisible();

    // 3. Fill and submit assistant form
    await page.locator('input[placeholder="My Assistant"]').fill(assistantName);
    await page
      .locator('input[placeholder="What does this assistant do?"]')
      .fill(assistantDesc);
    await page
      .locator('button[type="submit"]:has-text("Create Assistant")')
      .click();

    // 4. Verify assistant card appears in the list
    const assistantCard = page
      .locator(`[data-slot="card"]:has-text("${assistantName}")`)
      .first();
    await expect(assistantCard).toBeVisible({ timeout: 15_000 });

    // 5. Clicking card navigates directly to assistant-scoped chat session
    await assistantCard.click();
    await page.waitForURL(
      (url) =>
        url.pathname.includes("/assistants/") &&
        url.pathname.split("/").length >= 4,
      { timeout: 35_000 },
    );

    // 6. Send message in assistant-scoped chat
    await sendChatMessage(page, "Hello Assistant!");
    await waitForStreamComplete(page);
    await expect(page.locator("table").first()).toBeVisible({
      timeout: 10_000,
    });

    // 7. Navigate to Assistant detail page
    const pathSegments = new URL(page.url()).pathname.split("/");
    const assistantId = pathSegments[2];
    await page.goto(ROUTES.ASSISTANTS.detail(assistantId));
    await expect(
      page.getByRole("heading", { name: assistantName }),
    ).toBeVisible({ timeout: 15_000 });

    // 8. Switch to Danger Zone tab and delete assistant
    await page.locator('button[role="tab"]:has-text("Danger Zone")').click();
    const deleteBtn = page
      .locator('button:has-text("Delete Assistant")')
      .first();
    await expect(deleteBtn).toBeVisible({ timeout: 15_000 });
    await deleteBtn.click();

    // 9. Confirm deletion in dialog
    const confirmBtn = page.locator('button:has-text("Delete")').last();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 10. Verify redirected to assistants list and assistant is deleted
    await page.waitForURL(ROUTES.ASSISTANTS.path, { timeout: 15_000 });
    await expect(
      page.locator(`[data-slot="page-container"] [data-slot="card"]:has-text("${assistantName}")`),
    ).not.toBeVisible();

    // 11. Verify 404 boundary on nonexistent assistant
    await page.goto(
      ROUTES.ASSISTANTS.detail("00000000-0000-4000-a000-000000000000"),
    );
    await expect(page.locator("body")).toBeVisible();
    const notFoundIndicator = page.locator(
      ':is(:text("404"), :text("Not Found"), :text("not found"))',
    );
    await expect(notFoundIndicator.first()).toBeVisible({ timeout: 25_000 });
  });
});
