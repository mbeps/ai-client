import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatUI } from "@/components/chat/chat-ui";
import { ROUTES } from "@/config/routes";
import {
  NEW_CHAT_TOOLS_KEY,
  useChatToolsStore,
} from "@/lib/store/use-chat-tools-store";
import type { Chat } from "@/types/chat/chat";

vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: any[]) => mockToastError(...args),
  },
}));

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
vi.mock("@/components/chat/message-thread", () => ({
  MessageThread: () => null,
}));
vi.mock("@/components/chat/streaming-section", () => ({
  StreamingSection: () => null,
}));

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

const mockStreamResponse = vi.fn();
vi.mock("@/hooks/chat/use-stream-response", () => ({
  useStreamResponse: () => ({
    isLoading: false,
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

const mockCreateChatDb = vi.fn();
const mockSetKnowledgebaseDb = vi.fn();
let mockStoreState: Record<string, any> = {};
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: any) => selector(mockStoreState),
}));

function buildChat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: "chat-home-1",
    userId: "user-1",
    title: "Give me a list of Java projects",
    createdAt: new Date(),
    updatedAt: new Date(),
    currentLeafId: null,
    messages: {},
    ...overrides,
  } as Chat;
}

describe("ChatUI draft mode (HomePage) and initialMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastChatInputProps = null;
    useChatToolsStore.getState().clearAll();
    mockCreateChatDb.mockImplementation(async (title: string) => {
      const id = "chat-created-1";
      mockStoreState.chats = {
        ...mockStoreState.chats,
        [id]: buildChat({ id, title }),
      };
      return id;
    });
    mockSetKnowledgebaseDb.mockResolvedValue(undefined);
    mockStoreState = {
      chats: {},
      mcpServers: [{ id: "srv-1", name: "Maruf", enabled: true }],
      loadMcpServers: vi.fn().mockResolvedValue([]),
      agents: [],
      projects: [],
      prompts: [],
      skills: [],
      userSettings: {
        defaultChatModelId: "openrouter/free",
        defaultAutoApprove: false,
      },
      createChatDb: mockCreateChatDb,
      updateMessageMetadataDb: vi.fn(),
      deleteMessageDb: vi.fn(),
      setCurrentLeafDb: vi.fn(),
      setKnowledgebaseDb: mockSetKnowledgebaseDb,
    };
  });

  it("renders emptyState in draft mode, lazily creates chat on first send, transfers tools, and replaces URL", async () => {
    useChatToolsStore
      .getState()
      .setChatTools(NEW_CHAT_TOOLS_KEY, [
        "internal:tool:manage_artifact",
        "srv-1:tool:list_projects",
      ]);
    useChatToolsStore.getState().setChatApprovalMode(NEW_CHAT_TOOLS_KEY, "auto");

    const replaceSpy = vi.spyOn(window.history, "replaceState");

    render(
      <ChatUI emptyState={<div data-testid="welcome">Welcome</div>} />,
    );

    expect(screen.getByTestId("welcome")).toBeInTheDocument();
    expect(screen.queryByText("Chat not found.")).not.toBeInTheDocument();
    expect(lastChatInputProps?.chatId).toBe(NEW_CHAT_TOOLS_KEY);
    expect(lastChatInputProps?.onCompact).toBeUndefined();
    expect(lastChatInputProps?.onKnowledgebaseChange).toBeUndefined();

    const attachment = {
      id: "att-1",
      type: "document" as const,
      name: "spec.md",
      mimeType: "text/markdown",
      sizeBytes: 24,
      dataUrl: "data:text/markdown;base64,IyBoaQ==",
    };

    let result: boolean | undefined;
    await act(async () => {
      result = await lastChatInputProps?.onSend(
        "Give me a list of Java projects",
        [attachment],
        "nvidia/nemotron-3.5-lightning:free",
        ["srv-1"],
        ["internal:tool:manage_artifact", "srv-1:tool:list_projects"],
        ["prompt-1"],
        "agent-1",
        ["kb-1", "kb-2"],
        ["skill-1"],
        true,
        "sub-model-1",
        "high",
        ["sub-1"],
        "auto",
      );
    });

    expect(result).toBe(true);
    expect(mockCreateChatDb).toHaveBeenCalledWith(
      "Give me a list of Java projects",
    );
    expect(mockSetKnowledgebaseDb).toHaveBeenCalledWith(
      "chat-created-1",
      "kb-1",
    );
    expect(useChatToolsStore.getState().toolsByChat["chat-created-1"]).toEqual([
      "internal:tool:manage_artifact",
      "srv-1:tool:list_projects",
    ]);
    expect(
      useChatToolsStore.getState().approvalModeByChat["chat-created-1"],
    ).toBe("auto");
    expect(replaceSpy).toHaveBeenCalledWith(
      null,
      "",
      ROUTES.CHATS.detail("chat-created-1"),
    );
    expect(mockStreamResponse).toHaveBeenCalledWith(
      expect.any(String),
      "Give me a list of Java projects",
      null,
      [attachment],
      "nvidia/nemotron-3.5-lightning:free",
      ["srv-1"],
      ["internal:tool:manage_artifact", "srv-1:tool:list_projects"],
      ["prompt-1"],
      "agent-1",
      ["kb-1", "kb-2"],
      ["skill-1"],
      true,
      "sub-model-1",
      "high",
      ["sub-1"],
      "auto",
      "chat-created-1",
    );

    // Subsequent KB toggles now persist to the newly created chatId
    mockStoreState.chats["chat-created-1"] = buildChat({
      id: "chat-created-1",
    });
    expect(lastChatInputProps?.chatId).toBe("chat-created-1");
    expect(typeof lastChatInputProps?.onKnowledgebaseChange).toBe("function");

    replaceSpy.mockRestore();
  });

  it("rejects empty content without prompt in draft mode and handles createChatDb errors", async () => {
    render(<ChatUI />);

    let emptyResult: boolean | undefined;
    await act(async () => {
      emptyResult = await lastChatInputProps?.onSend("   ", [], "gpt-4o");
    });
    expect(emptyResult).toBe(false);
    expect(mockCreateChatDb).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      "Please enter a message before sending.",
    );

    mockCreateChatDb.mockRejectedValueOnce(new Error("DB down"));
    let errResult: boolean | undefined;
    await act(async () => {
      errResult = await lastChatInputProps?.onSend("Hello", [], "gpt-4o");
    });
    expect(errResult).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith("DB down");
    expect(mockStreamResponse).not.toHaveBeenCalled();

    mockCreateChatDb.mockRejectedValueOnce("unknown");
    let unknownErrResult: boolean | undefined;
    await act(async () => {
      unknownErrResult = await lastChatInputProps?.onSend(
        "   ",
        [],
        "gpt-4o",
        [],
        [],
        ["prompt-1"],
      );
    });
    expect(unknownErrResult).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith("Failed to start chat");
  });

  it("resets createdChatId when chatId prop changes", async () => {
    const { rerender } = render(<ChatUI />);

    await act(async () => {
      await lastChatInputProps?.onSend("First", [], "gpt-4o");
    });
    expect(lastChatInputProps?.chatId).toBe("chat-created-1");

    const chat2 = buildChat({ id: "chat-2" });
    rerender(<ChatUI chatId="chat-2" initialChat={chat2} />);
    expect(lastChatInputProps?.chatId).toBe("chat-2");
  });

  it("uses persisted chat tools from useChatToolsStore when ?msg= is used", () => {
    useChatToolsStore
      .getState()
      .setChatTools("chat-home-1", ["srv-1:tool:list_projects"]);
    useChatToolsStore.getState().setChatApprovalMode("chat-home-1", "auto");

    const chat = buildChat();
    render(
      <ChatUI
        chatId="chat-home-1"
        initialChat={chat}
        initialMessage="Direct query param message"
      />,
    );

    expect(mockStreamResponse).toHaveBeenCalledWith(
      expect.any(String),
      "Direct query param message",
      null,
      [],
      "openrouter/free",
      ["srv-1"],
      ["srv-1:tool:list_projects"],
      undefined,
      undefined,
      [],
      [],
      false,
      undefined,
      "medium",
      expect.any(Array),
      "auto",
    );
  });
});
