import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatUI } from "@/components/chat/chat-ui";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import type { Assistant } from "@/types/assistant/assistant";
import type { Chat } from "@/types/chat/chat";
import type { Project } from "@/types/project/project";

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

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: any) => selector(mockStoreState),
}));

describe("ChatUI - assistant tools seeding", () => {
  it("hands empty initialSelectedTools to ChatInput when assistant has canvas disabled", () => {
    const assistant: Assistant = {
      id: "asst-1",
      userId: "user-1",
      name: "Markdown Converter",
      description: "Converts text into markdown",
      prompt: "Raw markdown only",
      tools: [], // Canvas is disabled!
      skillMode: "dynamic",
      skillIds: [],
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const chat: Chat = {
      id: "chat-1",
      userId: "user-1",
      title: "Markdown conversion assistant",
      assistantId: "asst-1",
      projectId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: null,
      messages: {},
    } as Chat;

    mockStoreState = {
      chats: { [chat.id]: chat },
      mcpServers: [],
      loadMcpServers: vi.fn().mockResolvedValue([]),
      assistants: [assistant],
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

    expect(lastChatInputProps?.initialSelectedTools).toEqual([]);
    expect(lastChatInputProps?.initialSelectedTools).not.toContain(
      INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    );
  });

  it("hands empty initialSelectedTools to ChatInput when project has canvas disabled", () => {
    const project: Project = {
      id: "proj-1",
      userId: "user-1",
      name: "Markdown Project",
      description: "Project without canvas",
      globalPrompt: "Text only",
      tools: [], // Canvas disabled in project settings
      skillMode: "dynamic",
      skillIds: [],
      knowledgebaseId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const chat: Chat = {
      id: "chat-2",
      userId: "user-1",
      title: "Project Chat",
      assistantId: null,
      projectId: "proj-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      currentLeafId: null,
      messages: {},
    } as Chat;

    mockStoreState = {
      chats: { [chat.id]: chat },
      mcpServers: [],
      loadMcpServers: vi.fn().mockResolvedValue([]),
      assistants: [],
      projects: [project],
      prompts: [],
      skills: [],
      userSettings: null,
      updateMessageMetadataDb: vi.fn(),
      deleteMessageDb: vi.fn(),
      setCurrentLeafDb: vi.fn(),
      setKnowledgebaseDb: vi.fn(),
    };

    render(<ChatUI chatId="chat-2" initialChat={chat} />);

    expect(lastChatInputProps?.initialSelectedTools).toEqual([]);
    expect(lastChatInputProps?.initialSelectedTools).not.toContain(
      INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    );
  });
});
