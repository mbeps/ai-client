import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactPanelProps } from "@/components/chat/artifact-panel";
import { ChatUI } from "@/components/chat/chat-ui";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

// Track ArtifactPanel rendered props
let lastArtifactPanelProps: ArtifactPanelProps | null = null;

vi.mock("@/components/chat/artifact-panel", () => ({
  ArtifactPanel: (props: ArtifactPanelProps) => {
    lastArtifactPanelProps = props;
    if (!props.isOpen || !props.artifact) return null;
    return (
      <div data-testid="artifact-panel">
        <div data-testid="artifact-title">{props.artifact.title}</div>
        <div data-testid="artifact-index">{props.currentIndex}</div>
        <div data-testid="artifact-count">{props.artifacts?.length}</div>
        <button
          data-testid="nav-prev"
          onClick={() => props.onNavigate?.((props.currentIndex ?? 0) - 1)}
        >
          Prev
        </button>
        <button
          data-testid="nav-next"
          onClick={() => props.onNavigate?.((props.currentIndex ?? 0) + 1)}
        >
          Next
        </button>
      </div>
    );
  },
}));

vi.mock("@/components/chat/assistant-bar", () => ({
  AssistantBar: () => null,
}));

vi.mock("@/components/chat/chat-input", () => ({
  ChatInput: () => null,
}));

vi.mock("@/components/chat/message-thread", () => ({
  MessageThread: () => null,
}));

vi.mock("@/components/chat/streaming-section", () => ({
  StreamingSection: () => null,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: () => {},
}));

// Mock streaming response hook
let mockActiveToolCalls: ToolCallState[] = [];
let mockStreamingContent: string | null = null;
let mockIsLoading = false;

vi.mock("@/hooks/chat/use-stream-response", () => ({
  useStreamResponse: () => ({
    isLoading: mockIsLoading,
    streamingContent: mockStreamingContent,
    streamingReasoning: null,
    isStreamingReasoning: false,
    activeToolCalls: mockActiveToolCalls,
    streamResponse: vi.fn(),
    stopStream: vi.fn(),
  }),
}));

// Mock auth client
vi.mock("@/lib/auth/auth-client", () => ({
  authClient: {
    useSession: () => ({
      data: { user: { id: "user-1", name: "User" } },
    }),
  },
}));

// Mock store state
let mockStoreState: Record<string, any> = {};

vi.mock("@/lib/store", () => ({
  useAppStore: (selector: any) => selector(mockStoreState),
}));

function createMessageWithArtifact(
  id: string,
  artifactId: string,
  title: string,
  parentId: string | null,
): Message {
  return {
    id,
    chatId: "chat-1",
    role: "assistant",
    content: `Here is ${title}`,
    parentId,
    childrenIds: [],
    createdAt: new Date(),
    metadata: JSON.stringify({
      toolResults: [
        {
          toolName: "manage_artifact",
          toolCallId: `tc-${artifactId}`,
          result: {
            artifact: {
              id: artifactId,
              type: "markdown",
              title,
              content: `# ${title}`,
            },
          },
        },
      ],
    }),
  };
}

describe("ChatUI - Canvas Page Auto-Navigation", () => {
  beforeEach(() => {
    lastArtifactPanelProps = null;
    mockActiveToolCalls = [];
    mockStreamingContent = null;
    mockIsLoading = false;
    mockStoreState = {
      chats: {},
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

  it("automatically opens and displays initial canvas artifact", () => {
    const msg1 = createMessageWithArtifact(
      "msg-1",
      "art-1",
      "Page 1 Document",
      null,
    );
    const initialChat: Chat = {
      id: "chat-1",
      userId: "user-1",
      title: "Test Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-1",
      messages: {
        "msg-1": msg1,
      },
    };
    mockStoreState.chats["chat-1"] = initialChat;

    render(<ChatUI chatId="chat-1" initialChat={initialChat} />);

    expect(lastArtifactPanelProps).not.toBeNull();
    expect(lastArtifactPanelProps?.isOpen).toBe(true);
    expect(lastArtifactPanelProps?.currentIndex).toBe(0);
    expect(lastArtifactPanelProps?.artifact?.id).toBe("art-1");
    expect(lastArtifactPanelProps?.artifact?.title).toBe("Page 1 Document");
    expect(lastArtifactPanelProps?.artifacts?.length).toBe(1);
  });

  it("automatically navigates to new canvas page when edited by agent", () => {
    const msg1 = createMessageWithArtifact(
      "msg-1",
      "art-1",
      "Page 1 Document",
      null,
    );
    const initialChat: Chat = {
      id: "chat-1",
      userId: "user-1",
      title: "Test Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-1",
      messages: {
        "msg-1": msg1,
      },
    };
    mockStoreState.chats["chat-1"] = initialChat;

    const { rerender } = render(
      <ChatUI chatId="chat-1" initialChat={initialChat} />,
    );

    // Initial state: page 1 (index 0)
    expect(lastArtifactPanelProps?.currentIndex).toBe(0);
    expect(lastArtifactPanelProps?.artifacts?.length).toBe(1);

    // Agent edits the canvas: creates msg-2 with art-2
    const msg2 = createMessageWithArtifact(
      "msg-2",
      "art-2",
      "Page 2 Document (Updated)",
      "msg-1",
    );
    msg1.childrenIds = ["msg-2"];

    const updatedChat: Chat = {
      ...initialChat,
      currentLeafId: "msg-2",
      messages: {
        "msg-1": msg1,
        "msg-2": msg2,
      },
    };
    mockStoreState.chats["chat-1"] = updatedChat;

    rerender(<ChatUI chatId="chat-1" initialChat={updatedChat} />);

    // Verification: currentIndex automatically goes to 1 (newest page)
    expect(lastArtifactPanelProps?.isOpen).toBe(true);
    expect(lastArtifactPanelProps?.currentIndex).toBe(1);
    expect(lastArtifactPanelProps?.artifact?.id).toBe("art-2");
    expect(lastArtifactPanelProps?.artifact?.title).toBe(
      "Page 2 Document (Updated)",
    );
    expect(lastArtifactPanelProps?.artifacts?.length).toBe(2);
  });

  it("automatically navigates to new canvas page even if user was viewing an earlier version", () => {
    const msg1 = createMessageWithArtifact("msg-1", "art-1", "Page 1", null);
    const msg2 = createMessageWithArtifact("msg-2", "art-2", "Page 2", "msg-1");
    msg1.childrenIds = ["msg-2"];

    const initialChat: Chat = {
      id: "chat-1",
      userId: "user-1",
      title: "Test Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-2",
      messages: {
        "msg-1": msg1,
        "msg-2": msg2,
      },
    };
    mockStoreState.chats["chat-1"] = initialChat;

    const { rerender } = render(
      <ChatUI chatId="chat-1" initialChat={initialChat} />,
    );

    // On load, at latest page 2 (index 1)
    expect(lastArtifactPanelProps?.currentIndex).toBe(1);

    // User navigates back to page 1
    act(() => {
      lastArtifactPanelProps?.onNavigate?.(0);
    });
    expect(lastArtifactPanelProps?.currentIndex).toBe(0);

    // Agent edits canvas again (creating page 3)
    const msg3 = createMessageWithArtifact("msg-3", "art-3", "Page 3", "msg-2");
    msg2.childrenIds = ["msg-3"];

    const updatedChat: Chat = {
      ...initialChat,
      currentLeafId: "msg-3",
      messages: {
        "msg-1": msg1,
        "msg-2": msg2,
        "msg-3": msg3,
      },
    };
    mockStoreState.chats["chat-1"] = updatedChat;

    rerender(<ChatUI chatId="chat-1" initialChat={updatedChat} />);

    // Automatically jumps to index 2 (Page 3)
    expect(lastArtifactPanelProps?.currentIndex).toBe(2);
    expect(lastArtifactPanelProps?.artifact?.id).toBe("art-3");
    expect(lastArtifactPanelProps?.artifact?.title).toBe("Page 3");
  });

  it("automatically opens side panel and navigates to new page if panel was closed", () => {
    const msg1 = createMessageWithArtifact("msg-1", "art-1", "Page 1", null);
    const initialChat: Chat = {
      id: "chat-1",
      userId: "user-1",
      title: "Test Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-1",
      messages: {
        "msg-1": msg1,
      },
    };
    mockStoreState.chats["chat-1"] = initialChat;

    const { rerender } = render(
      <ChatUI chatId="chat-1" initialChat={initialChat} />,
    );

    // Close panel
    act(() => {
      lastArtifactPanelProps?.onClose();
    });
    expect(lastArtifactPanelProps?.isOpen).toBe(false);

    // Agent edits canvas
    const msg2 = createMessageWithArtifact("msg-2", "art-2", "Page 2", "msg-1");
    msg1.childrenIds = ["msg-2"];

    const updatedChat: Chat = {
      ...initialChat,
      currentLeafId: "msg-2",
      messages: {
        "msg-1": msg1,
        "msg-2": msg2,
      },
    };
    mockStoreState.chats["chat-1"] = updatedChat;

    rerender(<ChatUI chatId="chat-1" initialChat={updatedChat} />);

    // Panel is opened and displaying page 2
    expect(lastArtifactPanelProps?.isOpen).toBe(true);
    expect(lastArtifactPanelProps?.currentIndex).toBe(1);
    expect(lastArtifactPanelProps?.artifact?.id).toBe("art-2");
  });

  it("immediately displays new canvas page from active streaming tool call", () => {
    const msg1 = createMessageWithArtifact("msg-1", "art-1", "Page 1", null);
    const initialChat: Chat = {
      id: "chat-1",
      userId: "user-1",
      title: "Test Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-1",
      messages: {
        "msg-1": msg1,
      },
    };
    mockStoreState.chats["chat-1"] = initialChat;

    const { rerender } = render(
      <ChatUI chatId="chat-1" initialChat={initialChat} />,
    );
    expect(lastArtifactPanelProps?.currentIndex).toBe(0);

    // Agent executes tool manage_artifact during streaming
    mockIsLoading = true;
    mockActiveToolCalls = [
      {
        toolCallId: "tc-stream-art-2",
        toolName: "manage_artifact",
        status: "complete",
        result: {
          artifact: {
            id: "art-stream-2",
            type: "markdown",
            title: "Streaming Edited Canvas",
            content: "# Streaming Content",
          },
        },
      },
    ];

    rerender(<ChatUI chatId="chat-1" initialChat={initialChat} />);

    // Immediately navigates to streaming artifact
    expect(lastArtifactPanelProps?.isOpen).toBe(true);
    expect(lastArtifactPanelProps?.currentIndex).toBe(1);
    expect(lastArtifactPanelProps?.artifact?.id).toBe("art-stream-2");
    expect(lastArtifactPanelProps?.artifact?.title).toBe(
      "Streaming Edited Canvas",
    );
  });

  it("clamps artifact index when artifacts are deleted", () => {
    const msg1 = createMessageWithArtifact("msg-1", "art-1", "Page 1", null);
    const msg2 = createMessageWithArtifact("msg-2", "art-2", "Page 2", "msg-1");
    msg1.childrenIds = ["msg-2"];

    const initialChat: Chat = {
      id: "chat-1",
      userId: "user-1",
      title: "Test Chat",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-2",
      messages: {
        "msg-1": msg1,
        "msg-2": msg2,
      },
    };
    mockStoreState.chats["chat-1"] = initialChat;

    const { rerender } = render(
      <ChatUI chatId="chat-1" initialChat={initialChat} />,
    );
    expect(lastArtifactPanelProps?.currentIndex).toBe(1);

    // Delete msg-2: thread only has msg-1 now
    const updatedChat: Chat = {
      ...initialChat,
      currentLeafId: "msg-1",
      messages: {
        "msg-1": { ...msg1, childrenIds: [] },
      },
    };
    mockStoreState.chats["chat-1"] = updatedChat;

    rerender(<ChatUI chatId="chat-1" initialChat={updatedChat} />);

    expect(lastArtifactPanelProps?.currentIndex).toBe(0);
    expect(lastArtifactPanelProps?.artifacts?.length).toBe(1);
    expect(lastArtifactPanelProps?.artifact?.id).toBe("art-1");
  });

  it("resets artifact state when switching chats", () => {
    const msg1 = createMessageWithArtifact("msg-1", "art-1", "Page 1 Chat 1", null);
    const chat1: Chat = {
      id: "chat-1",
      userId: "user-1",
      title: "Chat 1",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-1",
      messages: { "msg-1": msg1 },
    };

    const chat2Msg = createMessageWithArtifact("msg-c2-1", "art-c2-1", "Page 1 Chat 2", null);
    const chat2: Chat = {
      id: "chat-2",
      userId: "user-1",
      title: "Chat 2",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: "msg-c2-1",
      messages: { "msg-c2-1": chat2Msg },
    };

    mockStoreState.chats["chat-1"] = chat1;
    mockStoreState.chats["chat-2"] = chat2;

    const { rerender } = render(<ChatUI chatId="chat-1" initialChat={chat1} />);
    expect(lastArtifactPanelProps?.artifact?.title).toBe("Page 1 Chat 1");

    // Switch to Chat 2
    rerender(<ChatUI chatId="chat-2" initialChat={chat2} />);
    expect(lastArtifactPanelProps?.artifact?.title).toBe("Page 1 Chat 2");
    expect(lastArtifactPanelProps?.currentIndex).toBe(0);
  });
});
