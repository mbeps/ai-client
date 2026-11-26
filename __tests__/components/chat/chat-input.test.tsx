import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/chat-input";
import { useChatToolsStore } from "@/lib/store/use-chat-tools-store";

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
    selectedModelObj: {
      id: "gpt-4o",
      capTools: true,
      capReasoning: true,
      reasoningEffortFormat: "openai",
    },
    handleApiError: vi.fn(() => false),
  }),
}));

vi.mock("@/components/shared/model-selector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));

vi.mock("@/components/chat/context-usage-pill", () => ({
  ContextUsagePill: () => <div data-testid="context-usage-pill" />,
}));

vi.mock("@/components/chat/input/reasoning-effort-selector", () => ({
  ReasoningEffortSelector: () => <div data-testid="reasoning-effort-selector" />,
  ModelReasoningEffortCard: () => null,
}));

describe("ChatInput minimalMode", () => {
  beforeEach(() => {
    useChatToolsStore.getState().clearAll();
  });

  it("renders attachments trigger by default (minimalMode=false)", () => {
    render(<ChatInput chatId="chat-default-1" onSend={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Attach files, tools & more" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("model-selector")).toBeInTheDocument();
    expect(screen.getByTestId("reasoning-effort-selector")).toBeInTheDocument();
    expect(screen.getByTestId("context-usage-pill")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tool approval mode: ask" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send message" }),
    ).toBeInTheDocument();
  });

  it("hides attachments trigger, file input, and subagent controls when minimalMode=true", () => {
    const { container } = render(
      <ChatInput
        chatId="chat-minimal-1"
        minimalMode={true}
        initialSubagentsEnabled={true}
        onSend={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Attach files, tools & more" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Manage subagents" }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();

    // Preserved controls
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByTestId("model-selector")).toBeInTheDocument();
    expect(screen.getByTestId("reasoning-effort-selector")).toBeInTheDocument();
    expect(screen.getByTestId("context-usage-pill")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tool approval mode: ask" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send message" }),
    ).toBeInTheDocument();
  });

  it("always sends empty serverIds, tools, kbIds, skillIds, and subagentsEnabled=false when minimalMode=true", () => {
    const onSend = vi.fn();

    render(
      <ChatInput
        chatId="chat-minimal-send"
        minimalMode={true}
        initialSelectedServerIds={["srv-1"]}
        initialSelectedTools={["internal:tool:manage_artifact"]}
        initialSelectedKbs={["kb-1"]}
        initialSelectedSkillIds={["skill-1"]}
        initialSubagentsEnabled={true}
        onSend={onSend}
      />,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Build a workflow" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSend).toHaveBeenCalledTimes(1);
    const args = onSend.mock.calls[0];
    expect(args[0]).toBe("Build a workflow");
    expect(args[3]).toEqual([]); // selectedServerIds
    expect(args[4]).toEqual([]); // selectedTools
    expect(args[7]).toEqual([]); // selectedKnowledgebases
    expect(args[8]).toEqual([]); // selectedSkillIds
    expect(args[9]).toBe(false); // subagentsEnabled
  });
});
