import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatUI } from "@/components/chat/chat-ui";
import { useGenerativeUIActions } from "@/components/chat/generative-ui/generative-ui-context";
import type { Chat } from "@/types/chat/chat";

vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/components/chat/artifact-panel", () => ({
  ArtifactPanel: () => null,
}));

vi.mock("@/components/chat/agent-bar", () => ({
  AgentBar: () => null,
}));

vi.mock("@/components/chat/streaming-section", () => ({
  StreamingSection: () => null,
}));

vi.mock("@/components/chat/chat-input", () => ({
  ChatInput: () => null,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

function MockWidgetConsumer() {
  const { sendMessage, isStreaming } = useGenerativeUIActions();
  return (
    <div>
      <span data-testid="streaming-flag">{String(isStreaming)}</span>
      <button
        type="button"
        onClick={() => {
          void sendMessage?.("Follow up prompt");
        }}
      >
        Send Follow Up
      </button>
      <button
        type="button"
        onClick={() => {
          void sendMessage?.("   ");
        }}
      >
        Send Blank
      </button>
    </div>
  );
}

vi.mock("@/components/chat/message-thread", () => ({
  MessageThread: () => <MockWidgetConsumer />,
}));

vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: () => ({ isLoading: false, loadingResources: [] }),
}));

const mockStreamResponse = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockStreamState = vi.hoisted(() => ({ isLoading: false }));

vi.mock("@/hooks/chat/use-stream-response", () => ({
  useStreamResponse: () => ({
    isLoading: mockStreamState.isLoading,
    streamingContent: null,
    streamingReasoning: null,
    isStreamingReasoning: false,
    activeToolCalls: [],
    streamResponse: mockStreamResponse,
    stopStream: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-1", name: "User" } } }),
  },
}));

const baseChat: Chat = {
  id: "chat-1",
  userId: "user-1",
  title: "Test Chat",
  projectId: null,
  agentId: null,
  assistantId: null,
  knowledgebaseId: null,
  currentLeafId: null,
  messages: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      chats: { "chat-1": baseChat },
      mcpServers: [],
      agents: [],
      projects: [],
      userSettings: null,
      deleteMessageDb: vi.fn(),
      setCurrentLeafDb: vi.fn(),
      setKnowledgebaseDb: vi.fn(),
      updateMessageMetadataDb: vi.fn(),
    }),
}));

describe("ChatUI GenerativeUIProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStreamState.isLoading = false;
  });

  it("dispatches trimmed follow-up messages through streamResponse when not streaming", async () => {
    render(<ChatUI chatId="chat-1" initialChat={baseChat} />);

    expect(screen.getByTestId("streaming-flag").textContent).toBe("false");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send Follow Up" }));
    });

    expect(mockStreamResponse).toHaveBeenCalledTimes(1);
    expect(mockStreamResponse).toHaveBeenCalledWith(
      expect.any(String),
      "Follow up prompt",
      null,
      [],
      expect.any(String),
      expect.any(Array),
      expect.any(Array),
      undefined,
      undefined,
      expect.any(Array),
      expect.any(Array),
      false,
      undefined,
      "medium",
      expect.any(Array),
      "ask",
    );
  });

  it("ignores blank prompts and blocks dispatches while streaming", async () => {
    const { rerender } = render(
      <ChatUI chatId="chat-1" initialChat={baseChat} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send Blank" }));
    });
    expect(mockStreamResponse).not.toHaveBeenCalled();

    mockStreamState.isLoading = true;
    rerender(<ChatUI chatId="chat-1" initialChat={baseChat} />);
    expect(screen.getByTestId("streaming-flag").textContent).toBe("true");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send Follow Up" }));
    });
    expect(mockStreamResponse).not.toHaveBeenCalled();
  });
});
