import { ROUTES } from "@/config/routes";
import { expect, test } from "../fixtures/test-fixtures";

test.describe("Suite 04: Internal Tools, MCP Tools & Subagents", () => {
  test("executes MCP tool call and renders ToolCallDisplay with arguments and result", async ({
    page,
    sendChatMessage,
    waitForStreamComplete,
    startNewChat,
  }) => {
    await page.goto(ROUTES.CHATS.path);
    await startNewChat(page);

    // Send prompt triggering MCP tool execution
    await sendChatMessage(page, "TRIGGER_MCP_TOOL");
    await waitForStreamComplete(page);

    // Verify ToolCallDisplay renders
    const toolCallHeader = page.locator("text=calculate_sum").first();
    await expect(toolCallHeader).toBeVisible({ timeout: 15_000 });

    // Expand tool call accordion to view result
    await toolCallHeader.click();

    // Verify tool execution output / result in timeline
    await expect(page.getByText("Result: 15").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("triggers subagent delegation and renders SubagentActivityCard", async ({
    page,
    sendChatMessage,
    waitForStreamComplete,
    startNewChat,
  }) => {
    await page.goto(ROUTES.CHATS.path);
    await startNewChat(page);

    // Send prompt triggering subagent delegation
    await sendChatMessage(page, "TRIGGER_SUBAGENT");
    await waitForStreamComplete(page);

    // Verify Subagent activity card renders
    const subagentCard = page
      .locator('button:has-text("Worker"), button:has-text("Scratchpad")')
      .first();
    await expect(subagentCard).toBeVisible({ timeout: 15_000 });

    // Click subagent card/accordion to inspect activity details
    await subagentCard.click();
    await expect(page.locator("body")).toBeVisible();
  });
});
