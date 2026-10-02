import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatUI } from "@/components/chat/chat-ui";
import type { Chat } from "@/types/chat/chat";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

vi.mock("@/components/chat/artifact-panel", () => ({
  ArtifactPanel: () => null,
}));

vi.mock("@/components/chat/assistant-bar", () => ({
  AssistantBar: () => null,
}));

let threadProps: Record<string, any> | null = null;
vi.mock("@/components/chat/message-thread", () => ({
  MessageThread: (props: Record<string, any>) => {
    threadProps = props;
    return null;
  },
}));

let streamingProps: Record<string, any> | null = null;
vi.mock("@/components/chat/streaming-section", () => ({
  StreamingSection: (props: Record<string, any>) => {
    streamingProps = props;
    return null;
  },
}));

let chatInputProps: Record<string, any> | null = null;
vi.mock("@/components/chat/chat-input", () => ({
  ChatInput: (props: Record<string, any>) => {
    chatInputProps = props;
    return null;
  },
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: () => ({ isLoading: false, loadingResources: [] }),
}));

vi.mock("@/hooks/chat/use-stream-response", () => ({
  useStreamResponse: () => ({
    isLoading: true,
    streamingContent: "partial",
    streamingReasoning: null,
    isStreamingReasoning: false,
    activeToolCalls: [],
    pendingApprovals: [
      {
        approvalId: "a1",
        toolCallId: "c1",
        toolName: "read_cells",
        args: {},
        signature: "s1",
      },
    ],
    approvalsDisabled: false,
    respondToApprovals: vi.fn(),
    streamResponse: vi.fn(),
    stopStream: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user-1", name: "User" } } }),
  },
}));

let mockStoreState: Record<string, any> = {};

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: any) => selector(mockStoreState),
}));

function buildChat(): Chat {
  return {
    id: "chat-1",
    userId: "user-1",
    title: "Test Chat",
    createdAt: new Date(),
    updatedAt: new Date(),
    currentLeafId: null,
    messages: {},
  } as Chat;
}

describe("ChatUI approval gate ownership", () => {
  beforeEach(() => {
    threadProps = null;
    streamingProps = null;
    const chat = buildChat();
    mockStoreState = {
      chats: { [chat.id]: chat },
      mcpServers: [],
      loadMcpServers: vi.fn().mockResolvedValue([]),
      assistants: [],
      projects: [],
      prompts: [],
      skills: [],
      userSettings: null,
      updateMessageMetadataDb: vi.fn(),
      deleteMessageDb: vi.fn(),
      setCurrentLeafDb: vi.fn(),
      setKnowledgebaseDb: vi.fn(),
    };
  });

  it("renders the gate on the thread only, never on the streaming bubble", () => {
    render(<ChatUI chatId="chat-1" initialChat={buildChat()} />);

    // The assistant row is the one the gate belongs to. The streaming bubble
    // is a transient stand-in for content that is not committed yet, so
    // handing it the same approvals makes two bubbles answer one round.
    expect(threadProps?.pendingApprovals).toHaveLength(1);
    expect(streamingProps?.pendingApprovals).toBeUndefined();
    expect(streamingProps?.onApproveDecisions).toBeUndefined();
    expect(streamingProps?.approvalsDisabled).toBeUndefined();
  });

  it("tells the streaming section a round is parked so it draws nothing", () => {
    render(<ChatUI chatId="chat-1" initialChat={buildChat()} />);

    // The parked round leaves isLoading true with only a tool call done. The
    // committed row already shows that call, so the streaming section must
    // not repeat it, which is the duplicated bubble the user reported.
    expect(streamingProps?.isLoading).toBe(true);
    expect(streamingProps?.pendingApprovalsCount).toBe(1);
  });
});

describe("ChatUI approval mode ownership", () => {
  beforeEach(() => {
    chatInputProps = null;
    threadProps = null;
    streamingProps = null;
    const chat = buildChat();
    mockStoreState = {
      chats: { [chat.id]: chat },
      mcpServers: [],
      loadMcpServers: vi.fn().mockResolvedValue([]),
      assistants: [],
      projects: [],
      prompts: [],
      skills: [],
      userSettings: null,
      approvalMode: "ask",
      setApprovalMode: vi.fn(),
      updateMessageMetadataDb: vi.fn(),
      deleteMessageDb: vi.fn(),
      setCurrentLeafDb: vi.fn(),
      setKnowledgebaseDb: vi.fn(),
    };
  });

  it("reads the mode from the store, not component state", () => {
    mockStoreState.approvalMode = "auto";
    render(<ChatUI chatId="chat-1" initialChat={buildChat()} />);

    // The mode lived in ChatUI state, so navigating from the home page to the
    // chat page remounted it and silently reverted to "ask". A session
    // preference has to outlive the component that hosts the composer.
    expect(chatInputProps?.initialApprovalMode).toBe("auto");
  });

  it("starts at ask when the store has never been set", () => {
    render(<ChatUI chatId="chat-1" initialChat={buildChat()} />);
    expect(chatInputProps?.initialApprovalMode).toBe("ask");
  });
});