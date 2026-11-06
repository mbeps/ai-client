import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StreamingAssistantBubble } from "@/components/chat/message/streaming-assistant-bubble";
import { SITE_CONFIG } from "@/config/site";
import type { ToolCallState } from "@/types/tool/tool-call";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

// Mock postmark
vi.mock("postmark", () => ({
  ServerClient: vi.fn().mockImplementation(function () {
    return { sendEmail: vi.fn().mockResolvedValue({}) };
  }),
}));

// Mock auth client
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: {
        user: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
        },
      },
    }),
  },
}));

// Mock store
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: any) =>
    selector({
      prompts: [],
      mcpServers: [],
      skills: [],
    }),
}));

// Mock useUserModels
vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({
    models: [{ modelId: "gpt-4o", name: "GPT-4o" }],
    isLoading: false,
  }),
}));

describe("StreamingAssistantBubble", () => {
  it("renders assistant header with default name and content", () => {
    render(<StreamingAssistantBubble content="Streaming token stream..." />);

    expect(screen.getByText(SITE_CONFIG.DEFAULT_ASSISTANT_NAME)).toBeDefined();
    expect(screen.getByText("Streaming token stream...")).toBeDefined();
  });

  it("renders with custom assistant name in header", () => {
    render(
      <StreamingAssistantBubble
        content="Streaming output"
        assistantName="Research Bot"
      />,
    );

    expect(screen.getByText("Research Bot")).toBeDefined();
  });

  it("renders with custom selected model name in header", () => {
    render(
      <StreamingAssistantBubble
        content="Streaming output"
        selectedModelName="Claude 3.7 Sonnet"
      />,
    );

    expect(screen.getByText("Claude 3.7 Sonnet")).toBeDefined();
  });

  it("renders reasoning timeline when reasoning is provided", () => {
    render(
      <StreamingAssistantBubble
        content="Final answer"
        reasoning="Pondering the solution step by step"
        isStreamingReasoning={true}
      />,
    );

    expect(screen.getByText("Thinking...")).toBeDefined();
  });

  it("renders citations when streaming citations exist", () => {
    const citations = [
      {
        documentId: "doc-1",
        documentName: "Annual Report 2026.pdf",
        content: "Revenue increased by 15%",
        s3Key: "reports/doc-1.pdf",
        score: 0.95,
      },
    ];

    render(
      <StreamingAssistantBubble
        content="Based on the report..."
        streamingCitations={citations}
      />,
    );

    expect(screen.getByText("Annual Report 2026.pdf")).toBeDefined();
  });

  it("extracts and renders completed artifacts from active tool calls", async () => {
    const onToggleArtifact = vi.fn();
    const activeToolCalls: ToolCallState[] = [
      {
        toolCallId: "call-1",
        toolName: "manage_artifact",
        state: "done",
        args: { title: "Draft Proposal", type: "markdown" },
        result: {
          id: "art-proposal",
          title: "Draft Proposal",
          type: "markdown",
          content: "# Proposal Details",
        },
      },
    ];

    render(
      <StreamingAssistantBubble
        content="Here is the generated proposal."
        activeToolCalls={activeToolCalls}
        onToggleArtifact={onToggleArtifact}
      />,
    );

    const artifactButton = screen.getByText("Draft Proposal");
    expect(artifactButton).toBeDefined();

    await userEvent.click(artifactButton);
    expect(onToggleArtifact).toHaveBeenCalled();
  });
});
