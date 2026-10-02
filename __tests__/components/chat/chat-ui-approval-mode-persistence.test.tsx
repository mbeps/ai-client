import { act, render } from "@testing-library/react";
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

vi.mock("@/components/chat/message-thread", () => ({
  MessageThread: () => null,
}));

vi.mock("@/components/chat/streaming-section", () => ({
  StreamingSection: () => null,
}));

// Capture the props ChatUI hands to the composer.
let lastChatInputProps: Record<string, any> | null = null;

vi.mock("@/components/chat/chat-input", () => ({
  ChatInput: (props: Record<string, any>) => {
    lastChatInputProps = props;
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
    isLoading: false,
    streamingContent: null,
    streamingReasoning: null,
    isStreamingReasoning: false,
    activeToolCalls: [],
    pendingApprovals: [],
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

function buildChat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: "chat-1",
    userId: "user-1",
    title: "Test Chat",
    createdAt: new Date(),
    updatedAt: new Date(),
    currentLeafId: null,
    messages: {},
    ...overrides,
  } as Chat;
}

function renderChatUI(chat: Chat) {
  // The mode now lives in the store, so the mock has to behave like one:
  // a write must be visible to the next render.
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
    setApprovalMode: (mode: string) => {
      mockStoreState.approvalMode = mode;
    },
    updateMessageMetadataDb: vi.fn(),
    deleteMessageDb: vi.fn(),
    setCurrentLeafDb: vi.fn(),
    setKnowledgebaseDb: vi.fn(),
  };
  render(<ChatUI chatId="chat-1" initialChat={chat} />);
  return lastChatInputProps;
}

describe("ChatUI approval mode persistence", () => {
  beforeEach(() => {
    lastChatInputProps = null;
  });

  it("keeps auto-approve enabled after a message is sent", async () => {
    renderChatUI(buildChat());

    // The user turned auto-approve on.
    act(() => {
      lastChatInputProps?.onApprovalModeChange?.("auto");
    });
    expect(mockStoreState.approvalMode).toBe("auto");

    // Sending a message must not silently revert it. Resetting to "ask" here
    // meant approval was demanded again for every tool after the first one.
    await act(async () => {
      await lastChatInputProps?.onSend?.("hello");
    });

    expect(mockStoreState.approvalMode).toBe("auto");
  });

  it("keeps ask mode after a message is sent", async () => {
    renderChatUI(buildChat());

    expect(lastChatInputProps?.initialApprovalMode).toBe("ask");

    await act(async () => {
      await lastChatInputProps?.onSend?.("hello");
    });

    expect(lastChatInputProps?.initialApprovalMode).toBe("ask");
  });

  it("passes the session mode to every send", async () => {
    const sentModes: unknown[] = [];
    renderChatUI(buildChat());

    act(() => {
      lastChatInputProps?.onApprovalModeChange?.("auto");
    });

    await act(async () => {
      await lastChatInputProps?.onSend?.("first");
      sentModes.push(mockStoreState.approvalMode);
      await lastChatInputProps?.onSend?.("second");
      sentModes.push(mockStoreState.approvalMode);
    });

    expect(sentModes).toEqual(["auto", "auto"]);
  });
});