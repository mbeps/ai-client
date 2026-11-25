import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/config/routes";

const { mockCreatePromptForUser, mockUpdatePromptForUser } = vi.hoisted(() => ({
  mockCreatePromptForUser: vi.fn(),
  mockUpdatePromptForUser: vi.fn(),
}));

vi.mock("@/lib/prompts/prompt-service", () => ({
  createPromptForUser: (...args: unknown[]) => mockCreatePromptForUser(...args),
  updatePromptForUser: (...args: unknown[]) => mockUpdatePromptForUser(...args),
}));

import { registerManagePromptTool } from "@/lib/app-tools/register-manage-prompt-tool";

const PROMPT_ID = "11111111-1111-4111-8111-111111111111";

describe("registerManagePromptTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("respects deferLoading option (default true)", () => {
    expect(
      (registerManagePromptTool("user-1").manage_prompt as { deferLoading?: boolean })
        .deferLoading,
    ).toBe(true);
    expect(
      (
        registerManagePromptTool("user-1", { deferLoading: false })
          .manage_prompt as { deferLoading?: boolean }
      ).deferLoading,
    ).toBe(false);
  });

  it("delegates create and update to prompt-service", async () => {
    const { manage_prompt } = registerManagePromptTool("user-1");

    mockCreatePromptForUser.mockResolvedValueOnce({
      ok: true,
      value: { id: PROMPT_ID, title: "Review", shortcut: "review" },
    });
    expect(
      await manage_prompt.execute!(
        {
          action: "create",
          title: "Review",
          shortcut: "review",
          content: "Review carefully",
        },
        { toolCallId: "tc-1", messages: [] },
      ),
    ).toEqual({
      success: true,
      action: "create",
      id: PROMPT_ID,
      title: "Review",
      shortcut: "review",
      route: ROUTES.PROMPTS.detail(PROMPT_ID),
    });

    mockCreatePromptForUser.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Bad prompt" },
    });
    expect(
      await manage_prompt.execute!(
        { action: "create", title: "Bad", shortcut: "bad", content: "c" },
        { toolCallId: "tc-1b", messages: [] },
      ),
    ).toEqual({ success: false, error: "Bad prompt" });

    mockUpdatePromptForUser.mockResolvedValueOnce({
      ok: false,
      error: { code: "NOT_FOUND", message: "Not Found" },
    });
    expect(
      await manage_prompt.execute!(
        { action: "update", id: PROMPT_ID, title: "X" },
        { toolCallId: "tc-2", messages: [] },
      ),
    ).toEqual({
      success: false,
      error: "Not Found",
    });

    mockCreatePromptForUser.mockResolvedValueOnce({
      ok: false,
      error: { code: "INVALID_INPUT", message: "Bad prompt" },
    });
    expect(
      await manage_prompt.execute!(
        { action: "create", title: "Bad", shortcut: "bad", content: "c" },
        { toolCallId: "tc-1b", messages: [] },
      ),
    ).toEqual({ success: false, error: "Bad prompt" });

    mockUpdatePromptForUser.mockResolvedValueOnce({
      ok: true,
      value: { id: PROMPT_ID, title: "Review v2", shortcut: "review" },
    });
    expect(
      await manage_prompt.execute!(
        { action: "update", id: PROMPT_ID, title: "Review v2" },
        { toolCallId: "tc-3", messages: [] },
      ),
    ).toEqual({
      success: true,
      action: "update",
      id: PROMPT_ID,
      title: "Review v2",
      shortcut: "review",
      route: ROUTES.PROMPTS.detail(PROMPT_ID),
    });
  });
});
