import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/chat-input";
import {
  NEW_CHAT_TOOLS_KEY,
  useChatToolsStore,
} from "@/lib/store/use-chat-tools-store";

vi.mock("@/components/chat/input/use-chat-input-services", () => ({
  useChatInputServices: () => ({
    mcpServers: [],
    knowledgebases: [],
    skills: [],
    prompts: [],
    mcpPrompts: [],
    isMobile: false,
    hasNoModels: false,
    supportsVision: false,
    supportsTools: true,
    modelId: "gpt-4o",
    setModelId: vi.fn(),
    selectedModelObj: { id: "gpt-4o", capTools: true },
    handleApiError: vi.fn(() => false),
  }),
}));

vi.mock("@/components/shared/model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

vi.mock("@/components/chat/context-usage-pill", () => ({
  ContextUsagePill: () => <div data-testid="context-usage-pill" />,
}));

describe("ChatInput approval mode toggle", () => {
  beforeEach(() => {
    useChatToolsStore.getState().clearAll();
  });

  it("defaults to ask mode, toggles to auto, and persists in useChatToolsStore", () => {
    const onSend = vi.fn();

    render(<ChatInput chatId="chat-approval-1" onSend={onSend} />);

    const toggle = screen.getByRole("button", {
      name: "Tool approval mode: ask",
    });
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);

    const autoToggle = screen.getByRole("button", {
      name: "Tool approval mode: auto",
    });
    expect(autoToggle).toHaveAttribute("aria-pressed", "true");
    expect(
      useChatToolsStore.getState().approvalModeByChat["chat-approval-1"],
    ).toBe("auto");

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Run tool" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSend).toHaveBeenCalledTimes(1);
    const args = onSend.mock.calls[0];
    expect(args[13]).toBe("auto");
  });

  it("hydrates persisted approval mode across remount and transfers from NEW_CHAT_TOOLS_KEY", () => {
    useChatToolsStore
      .getState()
      .setChatApprovalMode(NEW_CHAT_TOOLS_KEY, "auto");
    useChatToolsStore
      .getState()
      .transferChatTools(NEW_CHAT_TOOLS_KEY, "chat-new-99");

    const { unmount } = render(
      <ChatInput chatId="chat-new-99" onSend={vi.fn()} />,
    );

    expect(
      screen.getByRole("button", { name: "Tool approval mode: auto" }),
    ).toHaveAttribute("aria-pressed", "true");

    unmount();

    // Remount with initialApprovalMode="ask" — persisted store choice wins
    render(
      <ChatInput
        chatId="chat-new-99"
        initialApprovalMode="ask"
        onSend={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Tool approval mode: auto" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
