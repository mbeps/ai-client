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
  render(<ChatUI chatId="chat-1" initialChat={chat} />);
  return lastChatInputProps;
}

describe("ChatUI - entity skill configuration reaches the composer", () => {
  beforeEach(() => {
    lastChatInputProps = null;
  });

  it("passes assistant skills to the composer when the chat has an assistant", () => {
    mockStoreState = {
      chats: {},
      mcpServers: [],
      loadMcpServers: vi.fn().mockResolvedValue([]),
      assistants: [
        {
          id: "asst-1",
          name: "Helper",
          skillMode: "specific",
          skillIds: ["sk-1", "sk-2"],
        },
      ],
      projects: [],
      prompts: [],
      skills: [],
      userSettings: null,
      updateMessageMetadataDb: vi.fn(),
      deleteMessageDb: vi.fn(),
      setCurrentLeafDb: vi.fn(),
      setKnowledgebaseDb: vi.fn(),
    };

    const chat = buildChat({ assistantId: "asst-1" });
    render(<ChatUI chatId="chat-1" initialChat={chat} />);

    expect(lastChatInputProps?.initialSelectedSkillIds).toEqual([
      "sk-1",
      "sk-2",
    ]);
  });

  it("falls back to project skills when the chat has no assistant", () => {
    mockStoreState = {
      chats: {},
      mcpServers: [],
      loadMcpServers: vi.fn().mockResolvedValue([]),
      assistants: [],
      projects: [
        {
          id: "proj-1",
          name: "Project",
          skillMode: "specific",
          skillIds: ["sk-9"],
        },
      ],
      prompts: [],
      skills: [],
      userSettings: null,
      updateMessageMetadataDb: vi.fn(),
      deleteMessageDb: vi.fn(),
      setCurrentLeafDb: vi.fn(),
      setKnowledgebaseDb: vi.fn(),
    };

    const chat = buildChat({ projectId: "proj-1" });
    render(<ChatUI chatId="chat-1" initialChat={chat} />);

    expect(lastChatInputProps?.initialSelectedSkillIds).toEqual(["sk-9"]);
  });

  it("passes no skills when the entity disables skills entirely", () => {
    mockStoreState = {
      chats: {},
      mcpServers: [],
      loadMcpServers: vi.fn().mockResolvedValue([]),
      assistants: [
        {
          id: "asst-1",
          name: "Helper",
          skillMode: "none",
          skillIds: ["sk-1"],
        },
      ],
      projects: [],
      prompts: [],
      skills: [],
      userSettings: null,
      updateMessageMetadataDb: vi.fn(),
      deleteMessageDb: vi.fn(),
      setCurrentLeafDb: vi.fn(),
      setKnowledgebaseDb: vi.fn(),
    };

    const chat = buildChat({ assistantId: "asst-1" });
    render(<ChatUI chatId="chat-1" initialChat={chat} />);

    expect(lastChatInputProps?.initialSelectedSkillIds).toEqual([]);
  });
});