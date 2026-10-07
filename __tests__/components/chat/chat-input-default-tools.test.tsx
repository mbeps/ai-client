import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/chat-input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_ENABLED_TOOLS, INTERNAL_TOOL_IDS } from "@/config/tools";

// Mock env
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

// Mock hooks used by ChatInput
let mockUserModels = [
  {
    id: "m-1",
    modelId: "gpt-4o",
    name: "GPT-4o",
    capTools: true,
    capVision: true,
  },
];

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({
    models: mockUserModels,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-knowledgebases", () => ({
  useKnowledgebases: () => ({
    normalizedKnowledgebases: [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/hooks/use-api-error", () => ({
  useApiError: () => ({ handleApiError: vi.fn() }),
}));

vi.mock("@/lib/store", () => ({
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
    selectedPrompt: null,
    setSelectedPrompt: vi.fn(),
    selectedAssistant: null,
    setSelectedAssistant: vi.fn(),
  }),
}));

describe("Default Active Tools", () => {
  it("exports correct default tool IDs and internal tool constant", () => {
    expect(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT).toBe(
      "internal:tool:manage_artifact",
    );
    expect(INTERNAL_TOOL_IDS.MANAGE_SKILL).toBe("internal:tool:manage_skill");
    expect(INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE).toBe(
      "internal:tool:search_knowledge_base",
    );
    expect(DEFAULT_ENABLED_TOOLS).toEqual([
      "internal:tool:manage_artifact",
      "internal:tool:manage_skill",
      "internal:tool:search_knowledge_base",
    ]);
  });

  it("submits with DEFAULT_ENABLED_TOOLS when initialSelectedTools is not provided", () => {
    const handleSend = vi.fn();
    mockUserModels = [
      {
        id: "m-1",
        modelId: "gpt-4o",
        name: "GPT-4o",
        capTools: true,
        capVision: true,
      },
    ];

    render(
      <TooltipProvider>
        <ChatInput onSend={handleSend} initialModelId="gpt-4o" />
      </TooltipProvider>,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Create an artifact" } });

    const submitBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(submitBtn);

    expect(handleSend).toHaveBeenCalledTimes(1);
    const selectedToolsPassed = handleSend.mock.calls[0][4];
    // Asserted against the constant so adding a default tool does not fail here.
    expect(selectedToolsPassed).toEqual(DEFAULT_ENABLED_TOOLS);
  });

  it("auto-suppresses default tools when selected model lacks tool calling support", () => {
    const handleSend = vi.fn();
    mockUserModels = [
      {
        id: "m-no-tools",
        modelId: "simple-llm",
        name: "Simple LLM",
        capTools: false,
        capVision: false,
      },
    ];

    render(
      <TooltipProvider>
        <ChatInput onSend={handleSend} initialModelId="simple-llm" />
      </TooltipProvider>,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello non-tool model" } });

    const submitBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(submitBtn);

    expect(handleSend).toHaveBeenCalledTimes(1);
    const selectedToolsPassed = handleSend.mock.calls[0][4];
    expect(selectedToolsPassed).toEqual([]);
  });

  it("honors explicitly empty initialSelectedTools when passed", () => {
    const handleSend = vi.fn();
    mockUserModels = [
      {
        id: "m-1",
        modelId: "gpt-4o",
        name: "GPT-4o",
        capTools: true,
        capVision: true,
      },
    ];

    render(
      <TooltipProvider>
        <ChatInput
          onSend={handleSend}
          initialModelId="gpt-4o"
          initialSelectedTools={[]}
        />
      </TooltipProvider>,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "No tools message" } });

    const submitBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(submitBtn);

    expect(handleSend).toHaveBeenCalledTimes(1);
    const selectedToolsPassed = handleSend.mock.calls[0][4];
    expect(selectedToolsPassed).toEqual([]);
  });
});
