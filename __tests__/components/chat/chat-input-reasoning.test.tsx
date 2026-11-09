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

let mockUserModels = [
  {
    id: "m-reasoning",
    modelId: "o3-mini",
    name: "o3-mini",
    label: "o3-mini",
    capTools: true,
    capVision: false,
    capReasoning: true,
    reasoningEffortFormat: "openai",
  },
  {
    id: "m-plain",
    modelId: "gpt-4o",
    name: "GPT-4o",
    label: "GPT-4o",
    capTools: true,
    capVision: true,
    capReasoning: false,
    reasoningEffortFormat: "none",
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

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: () => [],
}));

vi.mock("@/hooks/use-local-prompts", () => ({
  useLocalPrompts: () => ({
    prompts: [],
  }),
}));

vi.mock("@/hooks/use-skills", () => ({
  useSkills: () => ({
    skills: [],
    installedSkills: [],
    isLoading: false,
  }),
}));

describe("ChatInput Reasoning Effort", () => {
  it("renders ReasoningEffortSelector when selected model supports reasoning with a valid format", () => {
    const handleSend = vi.fn();
    render(
      <TooltipProvider>
        <ChatInput
          onSend={handleSend}
          initialModelId="o3-mini"
          initialReasoningEffort="high"
        />
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", {
      name: /Reasoning effort: High/i,
    });
    expect(trigger).toBeDefined();
    expect(screen.getByText("High")).toBeDefined();
  });

  it("does not render ReasoningEffortSelector when model does not support reasoning effort", () => {
    const handleSend = vi.fn();
    render(
      <TooltipProvider>
        <ChatInput onSend={handleSend} initialModelId="gpt-4o" />
      </TooltipProvider>,
    );

    expect(
      screen.queryByRole("button", { name: /Reasoning effort:/i }),
    ).toBeNull();
  });

  it("sends chosen reasoning effort on submit", () => {
    const handleSend = vi.fn();
    render(
      <TooltipProvider>
        <ChatInput
          onSend={handleSend}
          initialModelId="o3-mini"
          initialReasoningEffort="low"
        />
      </TooltipProvider>,
    );

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Solve this math problem" } });

    const sendBtn = screen.getByLabelText("Send message");
    fireEvent.click(sendBtn);

    expect(handleSend).toHaveBeenCalledTimes(1);
    const lastCall = handleSend.mock.calls[0];
    // Signature: (content, attachments, model, servers, tools, promptId, assistantId, kbs, skills, subagentsEnabled, subagentModelId, reasoningEffort)
    expect(lastCall[0]).toBe("Solve this math problem");
    expect(lastCall[11]).toBe("low");
  });

  it("allows changing reasoning effort via slider popup before submitting", () => {
    const handleSend = vi.fn();
    render(
      <TooltipProvider>
        <ChatInput
          onSend={handleSend}
          initialModelId="o3-mini"
          initialReasoningEffort="medium"
        />
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", {
      name: /Reasoning effort: Medium/i,
    });
    fireEvent.click(trigger);

    const sliderInput = screen.getByRole("slider", {
      name: /Reasoning effort/i,
    });
    fireEvent.change(sliderInput, { target: { value: "3" } });

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Deep analysis please" } });

    const sendBtn = screen.getByLabelText("Send message");
    fireEvent.click(sendBtn);

    expect(handleSend).toHaveBeenCalledTimes(1);
    expect(handleSend.mock.calls[0][11]).toBe("high");
  });
});
