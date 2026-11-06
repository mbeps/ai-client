import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/chat-input";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";

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

describe("ChatInput - inherited tool seed resync", () => {
  it("re-seeds tools when assistant tool defaults arrive after mount", () => {
    const handleSend = vi.fn();
    const { rerender } = render(
      <TooltipProvider>
        <ChatInput
          onSend={handleSend}
          initialModelId="gpt-4o"
          initialSelectedTools={[...DEFAULT_ENABLED_TOOLS]}
        />
      </TooltipProvider>,
    );

    // Assistant hydrates from store with empty tools (canvas disabled)
    rerender(
      <TooltipProvider>
        <ChatInput
          onSend={handleSend}
          initialModelId="gpt-4o"
          initialSelectedTools={[]}
        />
      </TooltipProvider>,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Hello" } });

    const submitBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(submitBtn);

    expect(handleSend).toHaveBeenCalledTimes(1);
    const selectedToolsPassed = handleSend.mock.calls[0][4];
    expect(selectedToolsPassed).toEqual([]);
  });
});
