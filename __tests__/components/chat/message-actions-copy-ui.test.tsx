import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Message } from "@/types/message/message";

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({
    models: [{ modelId: "gpt-4o", name: "GPT-4o" }],
    isLoading: false,
  }),
}));

vi.mock("@/components/chat/message/message-details", () => ({
  MessageDetails: () => null,
}));

import { MessageActions } from "@/components/chat/message/message-actions";

const baseMessage: Message = {
  id: "msg-1",
  role: "assistant",
  content: "",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  parentId: null,
  chatId: "chat-1",
  metadata: null,
  attachments: [],
};

describe("MessageActions Copy with Generative UI", () => {
  const writeTextMock = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  it("strips interactive UI blocks and shows info toast when copying a message with spec/ui fences", async () => {
    const content = [
      "Here is your summary:",
      "",
      "```spec",
      '{"root":"card","elements":{}}',
      "```",
      "",
      "Let me know if you need more details.",
    ].join("\n");

    render(
      <TooltipProvider>
        <MessageActions
          message={baseMessage}
          isUser={false}
          contentToCopy={content}
          onDelete={vi.fn()}
          siblings={[]}
          currentSiblingIndex={0}
          onNavigateBranch={vi.fn()}
        />
      </TooltipProvider>,
    );

    const copyButton = screen.getByRole("button", { name: "Copy markdown" });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      "Here is your summary:\n\n[Interactive UI omitted]\n\nLet me know if you need more details.",
    );
    expect(mockToast.info).toHaveBeenCalledWith(
      "Copied text — interactive UI blocks were omitted",
    );
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("copies raw markdown and shows success toast when no interactive UI blocks are present", async () => {
    const content = "Plain markdown response with `inline` code.";

    render(
      <TooltipProvider>
        <MessageActions
          message={baseMessage}
          isUser={false}
          contentToCopy={content}
          onDelete={vi.fn()}
          siblings={[]}
          currentSiblingIndex={0}
          onNavigateBranch={vi.fn()}
        />
      </TooltipProvider>,
    );

    const copyButton = screen.getByRole("button", { name: "Copy markdown" });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(writeTextMock).toHaveBeenCalledWith(content);
    expect(mockToast.success).toHaveBeenCalledWith("Copied to clipboard");
    expect(mockToast.info).not.toHaveBeenCalled();
  });
});
