import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  hasRenderableStreamContent,
  StreamingSection,
} from "@/components/chat/streaming-section";

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

describe("hasRenderableStreamContent", () => {
  it("returns false when all stream values are null or empty", () => {
    expect(
      hasRenderableStreamContent({
        streamingContent: null,
        streamingReasoning: null,
        streamingCitations: [],
        activeToolCalls: [],
      }),
    ).toBe(false);
  });

  it("returns true when content is non-null", () => {
    expect(
      hasRenderableStreamContent({
        streamingContent: "hello",
        streamingReasoning: null,
        streamingCitations: [],
        activeToolCalls: [],
      }),
    ).toBe(true);
  });

  it("returns true when reasoning is non-null", () => {
    expect(
      hasRenderableStreamContent({
        streamingContent: null,
        streamingReasoning: "thinking...",
        streamingCitations: [],
        activeToolCalls: [],
      }),
    ).toBe(true);
  });

  it("returns true when streaming citations exist", () => {
    expect(
      hasRenderableStreamContent({
        streamingContent: null,
        streamingReasoning: null,
        streamingCitations: [
          {
            documentId: "d1",
            content: "c1",
            documentName: "Doc",
            s3Key: "k",
            score: 1,
          },
        ],
        activeToolCalls: [],
      }),
    ).toBe(true);
  });

  it("returns true when active tool calls exist", () => {
    expect(
      hasRenderableStreamContent({
        streamingContent: null,
        streamingReasoning: null,
        streamingCitations: [],
        activeToolCalls: [
          {
            toolCallId: "tc-1",
            toolName: "search",
            args: {},
            state: "running",
          },
        ],
      }),
    ).toBe(true);
  });
});

describe("StreamingSection", () => {
  it("renders null when not loading and no content is streaming", () => {
    const { container } = render(
      <StreamingSection
        isLoading={false}
        streamingContent={null}
        streamingReasoning={null}
        isStreamingReasoning={false}
        activeToolCalls={[]}
        streamingCitations={[]}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders StreamingPlaceholder while waiting for the first chunk", () => {
    render(
      <StreamingSection
        isLoading={true}
        streamingContent={null}
        streamingReasoning={null}
        isStreamingReasoning={false}
        activeToolCalls={[]}
        streamingCitations={[]}
      />,
    );

    expect(screen.getByTestId("streaming-placeholder")).toBeDefined();
    expect(screen.queryByTestId("streaming-assistant-bubble")).toBeNull();
  });

  it("renders StreamingAssistantBubble once content arrives", () => {
    render(
      <StreamingSection
        isLoading={true}
        streamingContent="First tokens arrived!"
        streamingReasoning={null}
        isStreamingReasoning={false}
        activeToolCalls={[]}
        streamingCitations={[]}
      />,
    );

    expect(screen.queryByTestId("streaming-placeholder")).toBeNull();
    expect(screen.getByTestId("streaming-assistant-bubble")).toBeDefined();
    expect(screen.getByText("First tokens arrived!")).toBeDefined();
  });

  it("renders StreamingAssistantBubble when reasoning arrives before content", () => {
    render(
      <StreamingSection
        isLoading={true}
        streamingContent={null}
        streamingReasoning="Pondering deeply..."
        isStreamingReasoning={true}
        activeToolCalls={[]}
        streamingCitations={[]}
      />,
    );

    expect(screen.queryByTestId("streaming-placeholder")).toBeNull();
    expect(screen.getByTestId("streaming-assistant-bubble")).toBeDefined();
    expect(screen.getByText("Thinking...")).toBeDefined();
  });
});

