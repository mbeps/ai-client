import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatUI } from "@/components/chat/chat-ui";
import { useChatToolsStore } from "@/lib/store/use-chat-tools-store";
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

describe("ChatUI pending launch handoff from HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastChatInputProps = null;
    useChatToolsStore.getState().clearAll();
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
      updateMessageMetadataDb: vi.fn(),
      deleteMessageDb: vi.fn(),
      setCurrentLeafDb: vi.fn(),
      setKnowledgebaseDb: vi.fn(),
    };
  });

  it("seeds ChatInput and dispatches all 14 parameters from pendingLaunchByChat, then clears it", () => {
    const attachment = {
      id: "att-1",
      type: "document" as const,
      name: "spec.md",
      mimeType: "text/markdown",
      sizeBytes: 24,
      dataUrl: "data:text/markdown;base64,IyBoaQ==",
    };

    useChatToolsStore.getState().setPendingLaunch("chat-home-1", {
      content: "Give me a list of Java projects",
      attachments: [attachment],
      model: "nvidia/nemotron-3.5-lightning:free",
      selectedServerIds: ["srv-1"],
      selectedTools: [
        "internal:tool:manage_artifact",
        "srv-1:tool:list_projects",
      ],
      selectedPromptId: ["prompt-1"],
      selectedAssistantId: "agent-1",
      selectedKnowledgebases: ["kb-1", "kb-2"],
      selectedSkillIds: ["skill-1"],
      subagentsEnabled: true,
      subagentModelId: "sub-model-1",
      reasoningEffort: "high",
      subagentIds: ["sub-1"],
      approvalMode: "auto",
    });

    const chat = buildChat();
    const onInitialMessageSent = vi.fn();

    render(
      <ChatUI
        chatId="chat-home-1"
        initialChat={chat}
        onInitialMessageSent={onInitialMessageSent}
      />,
    );

    expect(lastChatInputProps?.initialModelId).toBe(
      "nvidia/nemotron-3.5-lightning:free",
    );
    expect(lastChatInputProps?.initialSelectedServerIds).toEqual(["srv-1"]);
    expect(lastChatInputProps?.initialSelectedTools).toEqual([
      "internal:tool:manage_artifact",
      "srv-1:tool:list_projects",
    ]);
    expect(lastChatInputProps?.initialSelectedKbs).toEqual(["kb-1", "kb-2"]);
    expect(lastChatInputProps?.initialSubagentsEnabled).toBe(true);
    expect(lastChatInputProps?.initialSubagentModelId).toBe("sub-model-1");
    expect(lastChatInputProps?.initialSubagentIds).toEqual(["sub-1"]);
    expect(lastChatInputProps?.initialReasoningEffort).toBe("high");
    expect(lastChatInputProps?.initialApprovalMode).toBe("auto");
    // Per-turn skills should not remain pre-checked for the next message after initial send
    expect(lastChatInputProps?.initialSelectedSkillIds).toEqual([]);

    expect(mockStreamResponse).toHaveBeenCalledTimes(1);
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
    );
    expect(onInitialMessageSent).toHaveBeenCalledTimes(1);
    expect(
      useChatToolsStore.getState().pendingLaunchByChat["chat-home-1"],
    ).toBeUndefined();
  });

  it("uses persisted chat tools from useChatToolsStore when ?msg= is used without pendingLaunchByChat", () => {
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

  it("renders Chat not found when chat is missing and updates capturedLaunchState on chatId change", () => {
    const chat = buildChat();
    const { container, rerender } = render(
      <ChatUI chatId="chat-home-1" initialChat={chat} />,
    );

    rerender(<ChatUI chatId="chat-home-2" initialChat={undefined} />);
    expect(container.textContent).toContain("Chat not found.");
  });
});
