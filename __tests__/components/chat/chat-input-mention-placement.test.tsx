import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/chat-input";
import { TooltipProvider } from "@/components/ui/tooltip";

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

// Mock hooks
vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({
    models: [{ id: "m-1", modelId: "gpt-4o", name: "GPT-4o", capTools: true, capVision: true }],
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

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: () => [],
}));

vi.mock("@/hooks/chat/use-mention-commands", () => ({
  useMentionCommands: () => ({
    openTrigger: "/",
    filteredItems: [
      {
        id: "prompt-1",
        title: "Test Prompt",
        shortcut: "test-prompt",
      },
    ],
    selectedIndex: 0,
    handleSelect: vi.fn(),
    handleInputChange: vi.fn(),
    selectedAssistant: null,
    setSelectedAssistant: vi.fn(),
    selectedPrompts: [],
    setSelectedPrompts: vi.fn(),
  }),
}));

describe("ChatInput mention placement", () => {
  it("renders mention commands downwards when space above is less than 320px", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100,
      bottom: 200,
      left: 0,
      right: 400,
      width: 400,
      height: 100,
      x: 0,
      y: 100,
      toJSON: () => {},
    });

    let container: HTMLElement;
    render(
      <TooltipProvider>
        <ChatInput onSend={vi.fn()} />
      </TooltipProvider>,
    );

    const mentionContainer = await screen.findByRole("dialog", {}, { timeout: 1000 }).catch(() => null) ??
      document.querySelector(".fade-in-0");
    expect(mentionContainer).toHaveClass("top-full");
    expect(mentionContainer).toHaveClass("mt-2");
  });

  it("renders mention commands upwards when space above is 320px or more", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: 500,
      bottom: 600,
      left: 0,
      right: 400,
      width: 400,
      height: 100,
      x: 0,
      y: 500,
      toJSON: () => {},
    });

    render(
      <TooltipProvider>
        <ChatInput onSend={vi.fn()} />
      </TooltipProvider>,
    );

    const mentionContainer = await screen.findByRole("dialog", {}, { timeout: 1000 }).catch(() => null) ??
      document.querySelector(".fade-in-0");
    expect(mentionContainer).toHaveClass("bottom-full");
    expect(mentionContainer).toHaveClass("mb-2");
  });
});
