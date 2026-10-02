import { fireEvent, render, screen } from "@testing-library/react";
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

// Mock hooks used by ChatInput
const mockUserModels = [
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
  useAppStore: (selector: (state: unknown) => unknown) =>
    selector({
      skills: [],
      prompts: [],
      mcpPrompts: [],
    }),
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

const baseProps = { initialModelId: "gpt-4o" };

function renderInput(props: Partial<React.ComponentProps<typeof ChatInput>> = {}) {
  return render(
    <TooltipProvider>
      <ChatInput onSend={vi.fn()} {...baseProps} {...props} />
    </TooltipProvider>,
  );
}

function getToggle(): HTMLElement {
  return screen.getByRole("button", { name: /approval mode/i });
}

describe("ChatInput approval mode toggle", () => {
  it("defaults to asking before running tools", () => {
    renderInput();
    expect(getToggle()).toHaveAttribute("data-mode", "ask");
  });

  it("reports auto mode when toggled and returns to ask when toggled back", () => {
    renderInput();

    fireEvent.click(getToggle());
    expect(getToggle()).toHaveAttribute("data-mode", "auto");

    fireEvent.click(getToggle());
    expect(getToggle()).toHaveAttribute("data-mode", "ask");
  });

  it("passes the mode as the final onSend argument", () => {
    const onSend = vi.fn();
    renderInput({ onSend });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend.mock.calls[0].at(-1)).toBe("ask");
  });

  it("labels the toggle so the risk of auto mode is visible", () => {
    renderInput({ initialApprovalMode: "auto" });
    expect(
      screen.getByRole("button", { name: /auto-approve/i }),
    ).toHaveAttribute("data-mode", "auto");
  });

  it("lifts the change to the owner so a reset cannot leave a stale button", () => {
    const onApprovalModeChange = vi.fn();
    renderInput({ onApprovalModeChange });

    fireEvent.click(getToggle());

    expect(onApprovalModeChange).toHaveBeenCalledWith("auto");
  });
});
