import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 02: Chat Lifecycle, Streaming, Branching & Rate Limit UI", () => {
  test("creates chat, streams response with markdown, code block, and KaTeX", async ({
    page,
    sendChatMessage,
    waitForStreamComplete,
    startNewChat,
  }) => {
    await page.goto(ROUTES.CHATS.path);
    await startNewChat(page);

    // Send initial greeting
    await sendChatMessage(page, "Explain formula and code example");
    await waitForStreamComplete(page);

    // Verify Assistant response contains markdown elements from mock server
    const assistantBubble = page
      .locator(
        'table, code, p:has-text("Hello! Here is the requested analysis")',
      )
      .first();
    await expect(assistantBubble).toBeVisible();

    // Verify code block rendered
    const codeBlock = page
      .locator('code:has-text("export const answer"), pre code')
      .first();
    await expect(codeBlock).toBeVisible();

    // Verify KaTeX or Math formula rendered
    const mathFormula = page
      .locator('.katex, .math-display, .math-inline, [data-slot="math"]')
      .first();
    await expect(mathFormula).toBeVisible();
  });

  test("edits user message to create branch and navigates siblings", async ({
    page,
    sendChatMessage,
    waitForStreamComplete,
    startNewChat,
  }) => {
    await page.goto(ROUTES.CHATS.path);
    await startNewChat(page);

    await sendChatMessage(page, "First message branch");
    await waitForStreamComplete(page);

    // Hover user message to reveal action buttons
    const userMessage = page
      .locator('[data-role="user"], .bg-primary, .group')
      .first();
    await userMessage.hover();

    const editButton = page
      .locator('button[aria-label="Edit message"]')
      .first();
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Edit textarea
    const editTextarea = page
      .locator('textarea:has-text("First message branch"), textarea')
      .first();
    await editTextarea.fill("Edited second branch message");

    const saveButton = page
      .locator('button:has-text("Save"), button:has-text("Send")')
      .first();
    await saveButton.click();
    await waitForStreamComplete(page);

    // Verify branch indicator 2 / 2 is visible
    const branchCounter = page.locator("text=2 / 2").first();
    await expect(branchCounter).toBeVisible({ timeout: 10_000 });

    // Navigate to sibling 1 / 2
    const prevButton = page
      .locator("button:has(svg.lucide-chevron-left)")
      .first();
    await prevButton.click();
    await expect(page.locator("text=1 / 2").first()).toBeVisible();
  });

  test("regenerates assistant response creating alternative branch", async ({
    page,
    sendChatMessage,
    waitForStreamComplete,
    startNewChat,
  }) => {
    await page.goto(ROUTES.CHATS.path);
    await startNewChat(page);

    await sendChatMessage(page, "Message for regeneration test");
    await waitForStreamComplete(page);

    // Click Regenerate
    const regenerateButton = page
      .locator('button[aria-label="Regenerate response"]')
      .first();
    await expect(regenerateButton).toBeVisible();
    await regenerateButton.click();

    await waitForStreamComplete(page);

    // Verify response branched (2 / 2)
    const branchCounter = page.locator("text=2 / 2");
    await expect(branchCounter.first()).toBeVisible({ timeout: 10_000 });
  });

  test("stops in-flight generation when Stop button clicked", async ({
    page,
    sendChatMessage,
    startNewChat,
  }) => {
    await page.goto(ROUTES.CHATS.path);
    await startNewChat(page);

    // Send TRIGGER_SLOW_STREAM which streams 20 chunks spaced by 150ms
    await sendChatMessage(page, "TRIGGER_SLOW_STREAM");

    // Send button transitions to Stop button
    const stopButton = page
      .locator(
        'button[aria-label="Stop generation"], button:has(svg.lucide-square)',
      )
      .first();
    await expect(stopButton).toBeVisible({ timeout: 5_000 });
    await stopButton.click();

    // Verify input returns to idle state and send button reappears
    const sendButton = page
      .locator('button[aria-label="Send message"]')
      .first();
    await expect(sendButton).toBeVisible({ timeout: 10_000 });
  });

  test("renames chat and deletes chat via options menu", async ({
    page,
    sendChatMessage,
    waitForStreamComplete,
    startNewChat,
  }) => {
    await page.goto(ROUTES.CHATS.path);
    await startNewChat(page);

    await sendChatMessage(page, "Chat to be renamed");
    await waitForStreamComplete(page);

    // Open chat options in header
    const menuTrigger = page
      .locator(
        "header button:has(svg.lucide-more-horizontal), main button:has(svg.lucide-more-horizontal)",
      )
      .first();
    await expect(menuTrigger).toBeVisible();
    await menuTrigger.click();

    // Click Rename
    const renameOption = page.locator(
      '[role="menuitem"]:has-text("Rename"), button:has-text("Rename")',
    );
    await renameOption.click();

    const renameInput = page
      .locator('input[placeholder*="name"], input[type="text"]')
      .last();
    await renameInput.fill("Custom E2E Chat Title");
    const saveRenameButton = page
      .locator('button:has-text("Save"), button:has-text("Rename")')
      .last();
    await saveRenameButton.click();

    // Verify header reflects custom title
    await expect(
      page.locator("text=Custom E2E Chat Title").first(),
    ).toBeVisible({ timeout: 10_000 });

    // Open menu again to delete
    await menuTrigger.click();
    const deleteOption = page.locator(
      '[role="menuitem"]:has-text("Delete Chat"), button:has-text("Delete Chat")',
    );
    await deleteOption.click();

    // Confirm in dialog
    const confirmDelete = page
      .locator('[role="alertdialog"], [role="dialog"]')
      .locator('button:has-text("Delete")');
    await confirmDelete.click();

    // Verify redirect back to /chats
    await page.waitForURL((url) => url.pathname === ROUTES.CHATS.path, {
      timeout: 15_000,
    });
  });

  test("navigating to nonexistent chat renders 404 not-found boundary", async ({
    page,
  }) => {
    await page.goto("/chats/00000000-0000-4000-a000-000000000000");

    // Expect not-found component
    await expect(page.getByText("Chat not found")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("displays rate limit toast feedback on HTTP 429", async ({
    page,
    sendChatMessage,
    startNewChat,
  }) => {
    await page.goto(ROUTES.CHATS.path);
    await startNewChat(page);

    // Intercept chat stream with 429
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 429,
        headers: { "Retry-After": "15" },
        contentType: "text/plain",
        body: "Too Many Requests. Rate limit exceeded.",
      });
    });

    await sendChatMessage(page, "Rate limit test message");

    // Verify error toast
    const toast = page.locator("[data-sonner-toast]");
    await expect(toast.first()).toBeVisible({ timeout: 10_000 });

    // Unroute for future tests
    await page.unroute("**/api/chat");
  });
});
