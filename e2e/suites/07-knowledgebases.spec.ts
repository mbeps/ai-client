import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 07: Knowledge Bases CRUD, Document Upload & 404 Boundary", () => {
  test("creates knowledge base, uploads markdown document, deletes knowledge base, and verifies 404", async ({
    page,
    uniqueName,
  }) => {
    const kbName = uniqueName("QA-Knowledgebase");

    // 1. Navigate to Knowledgebases list page
    await page.goto(ROUTES.KNOWLEDGEBASES.path);
    await expect(page.locator("h1:has-text('Knowledgebases')")).toBeVisible();

    // 2. Open New Knowledgebase dialog
    await page.locator('button:has-text("New Knowledgebase")').click();
    await expect(
      page.locator('h2:has-text("New Knowledgebase")'),
    ).toBeVisible();

    // 3. Fill name and submit form
    await page.locator('input[placeholder="My Knowledgebase"]').fill(kbName);
    await page
      .locator('button[type="submit"]:has-text("Create Knowledgebase")')
      .click();

    // 4. Verify knowledgebase card appears in list
    const kbCard = page
      .locator(`[data-slot="card"]:has-text("${kbName}")`)
      .first();
    await expect(kbCard).toBeVisible({ timeout: 15_000 });

    // 5. Navigate to Knowledgebase detail page
    await kbCard.click();
    await page.waitForURL(
      (url) =>
        url.pathname.startsWith(ROUTES.KNOWLEDGEBASES.path) &&
        url.pathname !== ROUTES.KNOWLEDGEBASES.path,
    );
    await expect(page.getByRole("heading", { name: kbName })).toBeVisible({
      timeout: 10_000,
    });

    // 6. Open Upload Document dialog
    const uploadBtn = page.locator('button:has-text("Upload")').first();
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();
    await expect(page.locator('h2:has-text("Upload Document")')).toBeVisible();

    // 7. Select document file
    const docName = "qa-rag-spec.md";
    await page.locator('input[type="file"]').setInputFiles({
      name: docName,
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# High-Performance Architecture\n\nNext.js with AI SDK provides scalable full-stack LLM streaming workflows.\n",
      ),
    });

    // 8. Submit upload and verify success feedback
    const submitUploadBtn = page
      .locator('button:has-text("Upload"):not([disabled])')
      .last();
    await submitUploadBtn.click();
    const uploadToast = page.locator("[data-sonner-toast]");
    await expect(uploadToast.first()).toBeVisible({ timeout: 15_000 });

    // 9. Verify document row appears in DocumentList
    await expect(page.locator(`text="${docName}"`).first()).toBeVisible({
      timeout: 15_000,
    });

    // 10. Switch to Danger Zone tab
    const urlParts = page.url().split("/");
    const kbId = urlParts[4];
    await page.goto(`${ROUTES.KNOWLEDGEBASES.detail(kbId)}?tab=danger`);

    // 11. Delete Knowledgebase
    const deleteBtn = page
      .locator('button:has-text("Delete Knowledgebase")')
      .first();
    await expect(deleteBtn).toBeVisible({ timeout: 15_000 });
    await deleteBtn.click();

    // 12. Confirm deletion in dialog
    const confirmBtn = page.locator('button:has-text("Delete")').last();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 13. Verify redirected to Knowledgebases list and KB is deleted
    await page.waitForURL(ROUTES.KNOWLEDGEBASES.path, { timeout: 15_000 });
    await expect(page.locator(`text="${kbName}"`)).not.toBeVisible();

    // 14. Verify 404 boundary on nonexistent knowledge base
    await page.goto(
      ROUTES.KNOWLEDGEBASES.detail("00000000-0000-4000-a000-000000000000"),
    );
    await expect(page.locator("body")).toBeVisible();
    const notFoundIndicator = page.locator(
      ':is(:text("404"), :text("Not Found"), :text("This page could not be found"))',
    );
    await expect(notFoundIndicator.first()).toBeVisible({ timeout: 15_000 });
  });
});
