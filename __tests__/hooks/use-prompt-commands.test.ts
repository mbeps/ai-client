import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef } from "react";
import { usePromptCommands } from "@/hooks/chat/use-prompt-commands";
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
vi.mock("@/lib/actions/projects/toggle-project-pin", () => ({
  toggleProjectPin: vi.fn(),
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
vi.mock("@/lib/mcp/list-mcp-servers", () => ({ listMcpServers: vi.fn() }));
vi.mock("@/lib/mcp/create-mcp-server", () => ({ createMcpServer: vi.fn() }));
vi.mock("@/lib/mcp/delete-mcp-server", () => ({ deleteMcpServer: vi.fn() }));
vi.mock("@/lib/mcp/toggle-mcp-server", () => ({ toggleMcpServer: vi.fn() }));
vi.mock("@/lib/mcp/rename-mcp-server", () => ({ renameMcpServer: vi.fn() }));
vi.mock("@/lib/mcp/update-mcp-server", () => ({ updateMcpServer: vi.fn() }));
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
  {
    id: "p3",
    title: "Explain Code",
    shortcut: "explain",
    content: "Explain this code:",
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
describe("usePromptCommands", () => {
  const textareaRef = createRef<HTMLTextAreaElement>();

  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    useAppStore.setState({ prompts: SAMPLE_PROMPTS });
    vi.clearAllMocks();
  });

  // ── Initial state ────────────────────────────────────────────────────────
  describe("initial state", () => {
    it("starts with isCommandOpen=false", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );
      expect(result.current.isCommandOpen).toBe(false);
    });

    it("starts with no selected prompt", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );
      expect(result.current.selectedPrompt).toBeNull();
    });

    it("starts with an empty filteredPrompts list", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );
      expect(result.current.filteredPrompts).toHaveLength(0);
    });
  });

  // ── handleInputChange — command detection ─────────────────────────────
  describe("handleInputChange — slash command detection", () => {
    it("opens command palette when input starts with /", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      expect(result.current.isCommandOpen).toBe(true);
    });

    it("opens command palette when / follows a space", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("hello /", 7));
      });

      expect(result.current.isCommandOpen).toBe(true);
    });

    it("closes command palette when input has no / trigger", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      // First open it
      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });
      expect(result.current.isCommandOpen).toBe(true);

      // Then type normal text without /
      act(() => {
        result.current.handleInputChange(makeInputEvent("hello world", 11));
      });
      expect(result.current.isCommandOpen).toBe(false);
    });

    it("shows all prompts when query is empty (/)", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      expect(result.current.filteredPrompts).toHaveLength(
        SAMPLE_PROMPTS.length,
      );
    });

    it("filters prompts by shortcut match", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/sum", 4));
      });

      expect(result.current.filteredPrompts).toHaveLength(1);
      expect(result.current.filteredPrompts[0].shortcut).toBe("sum");
    });

    it("filters prompts by title match (case-insensitive)", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/TRANS", 6));
      });

      expect(result.current.filteredPrompts).toHaveLength(1);
      expect(result.current.filteredPrompts[0].title).toBe("Translate");
    });

    it("returns empty filteredPrompts when no prompts match", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/zzz", 4));
      });

      expect(result.current.filteredPrompts).toHaveLength(0);
    });

    it("calls setInput with the new value", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/sum", 4));
      });

      expect(setInput).toHaveBeenCalledWith("/sum");
    });
  });

  // ── handleKeyDown ─────────────────────────────────────────────────────
  describe("handleKeyDown", () => {
    it("returns false and does nothing when command palette is closed", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      const evt = makeKeyEvent("ArrowDown");
      let handled: boolean;
      act(() => {
        handled = result.current.handleKeyDown(evt);
      });

      expect(handled!).toBe(false);
      expect(evt.preventDefault).not.toHaveBeenCalled();
    });

    it("Escape closes the command palette", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });
      expect(result.current.isCommandOpen).toBe(true);

      act(() => {
        result.current.handleKeyDown(makeKeyEvent("Escape"));
      });
      expect(result.current.isCommandOpen).toBe(false);
    });

    it("ArrowDown increments selectedIndex", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      act(() => {
        result.current.handleKeyDown(makeKeyEvent("ArrowDown"));
      });

      expect(result.current.selectedIndex).toBe(1);
    });

    it("ArrowUp decrements selectedIndex (wraps around)", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      act(() => {
        result.current.handleKeyDown(makeKeyEvent("ArrowUp"));
      });

      // From 0, wraps to last index
      expect(result.current.selectedIndex).toBe(SAMPLE_PROMPTS.length - 1);
    });
  });

  // ── handlePromptSelect ────────────────────────────────────────────────
  describe("handlePromptSelect", () => {
    it("removes the / trigger from input when a prompt is selected", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("/sum", setInput, textareaRef),
      );

      // Simulate cursor at position 4
      act(() => {
        result.current.handleInputChange(makeInputEvent("/sum", 4));
      });

      act(() => {
        result.current.handlePromptSelect(SAMPLE_PROMPTS[0]);
      });

      // Should have called setInput with the slash removed
      expect(setInput).toHaveBeenLastCalledWith("");
    });

    it("sets the selectedPrompt", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("/sum", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/sum", 4));
      });

      act(() => {
        result.current.handlePromptSelect(SAMPLE_PROMPTS[0]);
      });

      expect(result.current.selectedPrompt).toEqual(SAMPLE_PROMPTS[0]);
    });

    it("closes the command palette after selection", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("/sum", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/sum", 4));
      });

      act(() => {
        result.current.handlePromptSelect(SAMPLE_PROMPTS[0]);
      });

      expect(result.current.isCommandOpen).toBe(false);
    });

    it("does nothing when input has no / before cursor", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("hello world", setInput, textareaRef),
      );

      // Simulate cursor at end of text with no slash
      act(() => {
        result.current.handleInputChange(makeInputEvent("hello world", 11));
      });

      const callsBefore = setInput.mock.calls.length;

      act(() => {
        result.current.handlePromptSelect(SAMPLE_PROMPTS[0]);
      });

      // setInput should not have been called again (no slash to remove)
      expect(setInput.mock.calls.length).toBe(callsBefore);
      expect(result.current.selectedPrompt).toBeNull();
    });
  });

  // ── handleKeyDown — additional branches ──────────────────────────────
  describe("handleKeyDown — additional branches", () => {
    it("Enter with empty filteredPrompts does not select anything", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      // Open with a query that matches nothing
      act(() => {
        result.current.handleInputChange(makeInputEvent("/zzz", 4));
      });
      expect(result.current.filteredPrompts).toHaveLength(0);

      const evt = makeKeyEvent("Enter");
      let handled: boolean;
      act(() => {
        handled = result.current.handleKeyDown(evt);
      });

      // Should return true (key was handled) but not set a prompt
      expect(handled!).toBe(true);
      expect(result.current.selectedPrompt).toBeNull();
    });

    it("unrecognised key returns false when command palette is open", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      const evt = makeKeyEvent("Tab");
      let handled: boolean;
      act(() => {
        handled = result.current.handleKeyDown(evt);
      });

      expect(handled!).toBe(false);
    });

    it("ArrowDown wraps from last index back to 0", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      // Navigate to last item
      act(() => {
        result.current.setSelectedIndex(SAMPLE_PROMPTS.length - 1);
      });

      act(() => {
        result.current.handleKeyDown(makeKeyEvent("ArrowDown"));
      });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  // ── handleInputChange — additional branches ──────────────────────────
  describe("handleInputChange — additional branches", () => {
    it("closes command palette when / is followed by a newline before cursor", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      // Open command palette first
      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });
      expect(result.current.isCommandOpen).toBe(true);

      // Type a newline after the slash (cursor past the newline)
      act(() => {
        result.current.handleInputChange(makeInputEvent("/\nhello", 7));
      });
      expect(result.current.isCommandOpen).toBe(false);
    });

    it("does not open command palette when a prompt is already selected", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("/sum", setInput, textareaRef),
      );

      // Select a prompt first
      act(() => {
        result.current.handleInputChange(makeInputEvent("/sum", 4));
      });
      act(() => {
        result.current.handlePromptSelect(SAMPLE_PROMPTS[0]);
      });
      expect(result.current.selectedPrompt).not.toBeNull();

      // Now try to type / again
      act(() => {
        result.current.handleInputChange(makeInputEvent("/new", 4));
      });

      expect(result.current.isCommandOpen).toBe(false);
    });

    it("closes command palette when / is not preceded by start or space", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        usePromptCommands("", setInput, textareaRef),
      );

      // slash in the middle of a word (e.g. "abc/def")
      act(() => {
        result.current.handleInputChange(makeInputEvent("abc/def", 7));
      });

      expect(result.current.isCommandOpen).toBe(false);
    });
  });
});
