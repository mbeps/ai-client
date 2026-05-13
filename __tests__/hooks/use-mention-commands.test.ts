import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import { useMentionCommands } from "@/hooks/chat/use-mention-commands";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/types/chat";

// ─── Safety-net mocks: prevent env/db/auth from loading ───────────────────
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    OPENROUTER_API_KEY: "test-key",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));
vi.mock("@/drizzle/db", () => ({ db: {} }));
vi.mock("@/lib/auth/auth", () => ({ auth: {} }));

// ─── Mock store dependencies (server actions) ─────────────────────────────
vi.mock("@/lib/actions/chats/create-chat", () => ({ createChat: vi.fn() }));
vi.mock("@/lib/actions/chats/delete-chat", () => ({ deleteChat: vi.fn() }));
vi.mock("@/lib/actions/chats/rename-chat", () => ({ renameChat: vi.fn() }));
vi.mock("@/lib/actions/chats/move-chat", () => ({ moveChat: vi.fn() }));
vi.mock("@/lib/actions/chats/delete-message", () => ({
  deleteMessage: vi.fn(),
}));
vi.mock("@/lib/actions/chats/update-current-leaf", () => ({
  updateCurrentLeaf: vi.fn(),
}));
vi.mock("@/lib/actions/chats/update-message-metadata", () => ({
  updateMessageMetadata: vi.fn(),
}));
vi.mock("@/lib/actions/projects/list-projects", () => ({
  listProjects: vi.fn(),
}));
vi.mock("@/lib/actions/projects/create-project", () => ({
  createProject: vi.fn(),
}));
vi.mock("@/lib/actions/projects/delete-project", () => ({
  deleteProject: vi.fn(),
}));
vi.mock("@/lib/actions/projects/rename-project", () => ({
  renameProject: vi.fn(),
}));
vi.mock("@/lib/actions/projects/update-project", () => ({
  updateProject: vi.fn(),
}));
vi.mock("@/lib/actions/projects/toggle-pin-project", () => ({
  togglePinProject: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/list-assistants", () => ({
  listAssistants: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/create-assistant", () => ({
  createAssistant: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/delete-assistant", () => ({
  deleteAssistant: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/rename-assistant", () => ({
  renameAssistant: vi.fn(),
}));
vi.mock("@/lib/actions/assistants/update-assistant", () => ({
  updateAssistant: vi.fn(),
}));
vi.mock("@/lib/actions/prompts/list-prompts", () => ({ listPrompts: vi.fn() }));
vi.mock("@/lib/actions/prompts/create-prompt", () => ({
  createPrompt: vi.fn(),
}));
vi.mock("@/lib/actions/prompts/delete-prompt", () => ({
  deletePrompt: vi.fn(),
}));
vi.mock("@/lib/actions/prompts/update-prompt", () => ({
  updatePrompt: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/list-mcp-servers", () => ({
  listMcpServers: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/create-mcp-server", () => ({
  createMcpServer: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/delete-mcp-server", () => ({
  deleteMcpServer: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/toggle-mcp-server", () => ({
  toggleMcpServer: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/rename-mcp-server", () => ({
  renameMcpServer: vi.fn(),
}));
vi.mock("@/lib/actions/mcp-servers/update-mcp-server", () => ({
  updateMcpServer: vi.fn(),
}));
vi.mock("@/lib/actions/projects/toggle-pin-project", () => ({
  togglePinProject: vi.fn(),
}));
vi.mock("@/lib/actions/knowledgebases/rename-knowledgebase", () => ({
  renameKnowledgebase: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────
const RESET_STATE = {
  chats: {} as Record<string, Chat>,
  projects: [],
  assistants: [],
  prompts: [],
  knowledgebases: [],
  mcpServers: [],
};

const SAMPLE_PROMPTS = [
  {
    id: "p1",
    title: "Summarise",
    shortcut: "sum",
    content: "Summarise the following:",
    updatedAt: new Date(),
  },
  {
    id: "p2",
    title: "Translate",
    shortcut: "trans",
    content: "Translate to English:",
    updatedAt: new Date(),
  },
];

const SAMPLE_ASSISTANTS = [
  {
    id: "a1",
    name: "Code Reviewer",
    description: "Reviews code",
    prompt: "You are a code reviewer",
    tools: [],
    knowledgebases: [],
    updatedAt: new Date(),
  },
  {
    id: "a2",
    name: "Translator",
    description: "Translates text",
    prompt: "You are a translator",
    tools: [],
    knowledgebases: [],
    updatedAt: new Date(),
  },
];

function makeInputEvent(value: string, selectionStart: number) {
  return {
    target: { value, selectionStart },
  } as React.ChangeEvent<HTMLTextAreaElement>;
}

function makeKeyEvent(key: string) {
  return { key, preventDefault: vi.fn() } as unknown as React.KeyboardEvent;
}

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("useMentionCommands", () => {
  const textareaRef = createRef<HTMLTextAreaElement>();

  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    useAppStore.setState({
      prompts: SAMPLE_PROMPTS,
      assistants: SAMPLE_ASSISTANTS,
    });
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("starts with openTrigger=null", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );
      expect(result.current.openTrigger).toBeNull();
    });

    it("starts with no selected prompt or assistant", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );
      expect(result.current.selectedPrompt).toBeNull();
      expect(result.current.selectedAssistant).toBeNull();
    });

    it("starts with an empty filteredItems list", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );
      expect(result.current.filteredItems).toHaveLength(0);
    });
  });

  describe("slash command detection (/)", () => {
    it("opens command palette when input starts with /", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      expect(result.current.openTrigger).toBe("/");
    });

    it("shows all prompts when query is empty (/)", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      expect(result.current.filteredItems).toHaveLength(SAMPLE_PROMPTS.length);
    });

    it("filters prompts by shortcut match", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/sum", 4));
      });

      expect(result.current.filteredItems).toHaveLength(1);
      expect((result.current.filteredItems[0] as any).shortcut).toBe("sum");
    });
  });

  describe("mention command detection (@)", () => {
    it("opens command palette when input starts with @", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("@", 1));
      });

      expect(result.current.openTrigger).toBe("@");
    });

    it("does not open if activeChatAssistantId is set", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef, "some-id"),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("@", 1));
      });

      expect(result.current.openTrigger).toBeNull();
    });

    it("shows all assistants when query is empty (@)", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("@", 1));
      });

      expect(result.current.filteredItems).toHaveLength(
        SAMPLE_ASSISTANTS.length,
      );
    });

    it("filters assistants by name match", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("@code", 5));
      });

      expect(result.current.filteredItems).toHaveLength(1);
      expect((result.current.filteredItems[0] as any).name).toBe(
        "Code Reviewer",
      );
    });
  });

  describe("handleSelect", () => {
    it("removes the / trigger and sets selectedPrompt", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("/sum", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/sum", 4));
      });

      act(() => {
        result.current.handleSelect(SAMPLE_PROMPTS[0]);
      });

      expect(setInput).toHaveBeenLastCalledWith("");
      expect(result.current.selectedPrompt).toEqual(SAMPLE_PROMPTS[0]);
      expect(result.current.openTrigger).toBeNull();
    });

    it("removes the @ trigger and sets selectedAssistant", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("@code", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("@code", 5));
      });

      act(() => {
        result.current.handleSelect(SAMPLE_ASSISTANTS[0]);
      });

      expect(setInput).toHaveBeenLastCalledWith("");
      expect(result.current.selectedAssistant).toEqual(SAMPLE_ASSISTANTS[0]);
      expect(result.current.openTrigger).toBeNull();
    });
  });

  describe("handleKeyDown", () => {
    it("Escape closes the command palette", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });
      expect(result.current.openTrigger).toBe("/");

      act(() => {
        result.current.handleKeyDown(makeKeyEvent("Escape"));
      });
      expect(result.current.openTrigger).toBeNull();
    });
  });
});
