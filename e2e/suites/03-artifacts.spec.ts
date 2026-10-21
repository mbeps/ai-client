import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 03: Canvas & Artifacts Panel", () => {
  test("generates artifact via tool call, renders Canvas panel, and supports actions", async ({
    page,
    sendChatMessage,
    waitForStreamComplete,
    startNewChat,
  }) => {
    await page.goto(ROUTES.CHATS.path);
    await startNewChat(page);

    // Send prompt triggering artifact generation in mock server
    await sendChatMessage(page, "TRIGGER_ARTIFACT");
    await waitForStreamComplete(page);

    // Verify CanvasCard appears in chat timeline
    const canvasCard = page.locator(
      '[aria-label*="canvas card"], [data-slot="card"]:has-text("System Architecture Spec")',
    );
    await expect(canvasCard.first()).toBeVisible({ timeout: 15_000 });

    // Verify ArtifactPanel is open with artifact title
    const artifactTitle = page.locator(
      'h3:has-text("System Architecture Spec")',
    );
    await expect(artifactTitle).toBeVisible({ timeout: 10_000 });

    // Test Copy button in panel
    const copyButton = page.locator('button[aria-label="Copy content"]');
    await expect(copyButton).toBeVisible();
    await copyButton.click();
    const copiedToast = page.locator("[data-sonner-toast]");
    await expect(copiedToast.first()).toBeVisible({ timeout: 10_000 });

    // Test Download button in panel
    const downloadPromise = page.waitForEvent("download");
    const downloadButton = page.locator('button[aria-label="Download file"]');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().toLowerCase()).toContain(
      "system_architecture_spec",
    );

    // Close artifact panel
    const closeButton = page.locator('button[aria-label="Close artifact"]');
    await closeButton.click();
    await expect(artifactTitle).not.toBeVisible();

    // Reopen panel by clicking the canvas card in message
    await canvasCard.first().click();
    await expect(artifactTitle).toBeVisible();
  });
});
