import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 11: User Memory Management CRUD & Toggle", () => {
  test("toggles memory, creates memory item, verifies card, and deletes memory item", async ({
    page,
    uniqueName,
  }) => {
    const memoryText = `User preference ${uniqueName("pref")}: Always respond in concise bullet points.`;

    // 1. Navigate to Settings Memory page
    await page.goto(ROUTES.SETTINGS.path.replace(/\/?$/, "/memory"));
    await expect(page.locator("h1:has-text('Memory')")).toBeVisible();

    // 2. Ensure memory is enabled (toggle switch if disabled)
    const memorySwitch = page.locator('button[role="switch"]#memory-toggle');
    await expect(memorySwitch).toBeVisible();
    const isChecked =
      (await memorySwitch.getAttribute("data-state")) === "checked";
    if (!isChecked) {
      await memorySwitch.click();
      await expect(memorySwitch).toHaveAttribute("data-state", "checked");
    }

    // 3. Open Add Memory dialog
    const addMemoryBtn = page.locator('button:has-text("Add Memory")');
    await expect(addMemoryBtn).toBeEnabled();
    await addMemoryBtn.click();
    await expect(page.locator('h2:has-text("Add Memory")')).toBeVisible();

    // 4. Fill memory content and save
    await page.locator("textarea#memory-content").fill(memoryText);
    await page.locator('button[type="submit"]').click();

    // 5. Verify memory toast and memory card appear
    const toast = page.locator("[data-sonner-toast]");
    await expect(toast.first()).toBeVisible({ timeout: 10_000 });
    const memoryCard = page
      .locator(`[data-slot="card"]:has-text("${memoryText}")`)
      .first();
    await expect(memoryCard).toBeVisible({ timeout: 15_000 });

    // 6. Delete memory item via card trash button
    const deleteBtn = memoryCard.locator('button[aria-label="Delete memory"]');
    await deleteBtn.click();

    // 7. Confirm deletion in AlertDialog
    const confirmDeleteBtn = page.locator(
      '[role="alertdialog"] button:has-text("Delete")',
    );
    await expect(confirmDeleteBtn).toBeVisible();
    await confirmDeleteBtn.click();

    // 8. Verify memory item is removed from list
    await expect(page.locator(`text="${memoryText}"`)).not.toBeVisible();
  });
});
