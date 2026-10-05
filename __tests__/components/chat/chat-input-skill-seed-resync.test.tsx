import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInput } from "@/components/chat/chat-input";
import { TooltipProvider } from "@/components/ui/tooltip";

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

function renderInput(initialSelectedSkillIds?: string[]) {
  return render(
    <TooltipProvider>
      <ChatInput
        onSend={vi.fn()}
        initialModelId="gpt-4o"
        initialSelectedSkillIds={initialSelectedSkillIds}
      />
    </TooltipProvider>,
  );
}

describe("ChatInput - inherited skill seed", () => {
  it("shows a pill for a skill supplied on first mount", () => {
    renderInput(["sk-1"]);

    expect(screen.getByText("/sk-1")).toBeInTheDocument();
  });

  it("re-seeds when the inherited skill arrives after mount (hard reload)", () => {
    const { rerender } = renderInput(undefined);

    // Store hydration resolves and ChatUI passes the seed down.
    rerender(
      <TooltipProvider>
        <ChatInput
          onSend={vi.fn()}
          initialModelId="gpt-4o"
          initialSelectedSkillIds={["sk-1"]}
        />
      </TooltipProvider>,
    );

    expect(screen.getByText("/sk-1")).toBeInTheDocument();
  });

  it("keeps user toggles when the seed is unchanged", () => {
    const { rerender } = renderInput(["sk-1"]);

    // Remove the inherited skill chip.
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(screen.queryByText("/sk-1")).not.toBeInTheDocument();

    // An unrelated re-render must not resurrect the removed skill.
    rerender(
      <TooltipProvider>
        <ChatInput
          onSend={vi.fn()}
          initialModelId="gpt-4o"
          initialSelectedSkillIds={["sk-1"]}
        />
      </TooltipProvider>,
    );

    expect(screen.queryByText("/sk-1")).not.toBeInTheDocument();
  });
});