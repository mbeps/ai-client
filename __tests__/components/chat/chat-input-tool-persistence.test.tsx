import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/chat-input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_ENABLED_TOOLS, INTERNAL_TOOL_IDS } from "@/config/tools";
import { useChatToolsStore } from "@/lib/store/use-chat-tools-store";

vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({
    models: [
      {
        id: "m-1",
        modelId: "gpt-4o",
        name: "GPT-4o",
        capTools: true,
        capVision: true,
      },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-knowledgebases", () => ({
  useKnowledgebases: () => ({
    normalizedKnowledgebases: [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));

vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => ({ handleApiError: vi.fn() }),
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: () => [],
}));

vi.mock("@/hooks/chat/use-mention-commands", () => ({
  useMentionCommands: (
    _input: string,
    setInput: (val: string) => void,
  ) => ({
    handleKeyDown: () => false,
    handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    selectedPrompts: [],
    setSelectedPrompts: vi.fn(),
    selectedAssistant: null,
    setSelectedAssistant: vi.fn(),
  }),
}));

describe("ChatInput tool persistence", () => {
  beforeEach(() => {
    useChatToolsStore.getState().clearAll();
  });

  it("restores persisted tool selections when mounting with chatId", () => {
    const handleSend = vi.fn();
    useChatToolsStore.getState().setChatTools("chat-persist-1", [
      "mcp-server-1:tool:custom_tool",
    ]);

    render(
      <TooltipProvider>
        <ChatInput
          chatId="chat-persist-1"
          onSend={handleSend}
          initialModelId="gpt-4o"
          initialSelectedTools={[...DEFAULT_ENABLED_TOOLS]}
        />
      </TooltipProvider>,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    const submitBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(submitBtn);

    expect(handleSend).toHaveBeenCalled();
    const callArgs = handleSend.mock.calls[0];
    const sentServerIds = callArgs[3];
    const sentTools = callArgs[4];

    expect(sentTools).toEqual(["mcp-server-1:tool:custom_tool"]);
    expect(sentServerIds).toEqual(["mcp-server-1"]);
  });

  it("honors persisted empty tools array across remounts", () => {
    const handleSend = vi.fn();
    useChatToolsStore.getState().setChatTools("chat-persist-empty", []);

    render(
      <TooltipProvider>
        <ChatInput
          chatId="chat-persist-empty"
          onSend={handleSend}
          initialModelId="gpt-4o"
          initialSelectedTools={[...DEFAULT_ENABLED_TOOLS]}
        />
      </TooltipProvider>,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "All tools disabled" } });
    const submitBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(submitBtn);

    expect(handleSend).toHaveBeenCalled();
    const sentTools = handleSend.mock.calls[0][4];
    expect(sentTools).toEqual([]);
    expect(sentTools).not.toContain(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT);
  });

  it("does not use store when chatId is omitted (e.g. user message editing)", () => {
    const handleSend = vi.fn();
    useChatToolsStore.getState().setChatTools("chat-1", [
      "mcp-server-1:tool:custom_tool",
    ]);

    render(
      <TooltipProvider>
        <ChatInput
          onSend={handleSend}
          initialModelId="gpt-4o"
          initialSelectedTools={[INTERNAL_TOOL_IDS.MANAGE_ARTIFACT]}
        />
      </TooltipProvider>,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Edit message" } });
    const submitBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(submitBtn);

    expect(handleSend).toHaveBeenCalled();
    const sentTools = handleSend.mock.calls[0][4];
    expect(sentTools).toEqual([INTERNAL_TOOL_IDS.MANAGE_ARTIFACT]);
  });
});
