import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMentionCommands } from "@/hooks/chat/use-mention-commands";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/types/chat/chat";

// ─── Safety-net mocks: prevent env/db/auth from loading ───────────────────
vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
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
vi.mock("@/actions/chats/create-chat", () => ({ createChat: vi.fn() }));
vi.mock("@/actions/chats/delete-chat", () => ({ deleteChat: vi.fn() }));
vi.mock("@/actions/chats/rename-chat", () => ({ renameChat: vi.fn() }));
vi.mock("@/actions/chats/move-chat", () => ({ moveChat: vi.fn() }));
vi.mock("@/actions/chats/delete-message", () => ({
  deleteMessage: vi.fn(),
}));
vi.mock("@/actions/chats/update-current-leaf", () => ({
  updateCurrentLeaf: vi.fn(),
}));
vi.mock("@/actions/chats/update-message-metadata", () => ({
  updateMessageMetadata: vi.fn(),
}));
vi.mock("@/actions/projects/list-projects", () => ({
  listProjects: vi.fn(),
}));
vi.mock("@/actions/assistants/list-assistants", () => ({
  listAssistants: vi.fn(),
}));
vi.mock("@/actions/prompts/list-prompts", () => ({ listPrompts: vi.fn() }));
vi.mock("@/actions/mcp-servers/list-mcp-servers", () => ({
  listMcpServers: vi.fn(),
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

const SAMPLE_KNOWLEDGEBASES = [
  {
    id: "kb1",
    userId: "u1",
    name: "Project Docs",
    description: "Project documentation",
    documentCount: 10,
    indexStatus: "ready" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "kb2",
    userId: "u1",
    name: "API Reference",
    description: "API reference docs",
    documentCount: 5,
    indexStatus: "stale" as const,
    createdAt: new Date(),
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
      skills: [],
      mcpPrompts: [],
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

    it("initializes selectedPrompt from local prompt id", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef, null, "p1"),
      );
      expect(result.current.selectedPrompt).toEqual(
        expect.objectContaining({ id: "p1", isMcp: false }),
      );
    });

    it("initializes selectedPrompt from mcp prompt id", () => {
      useAppStore.setState({
        mcpPrompts: [
          {
            serverId: "srv-1",
            serverName: "Server 1",
            name: "mcp-test",
            description: "Test mcp prompt",
          },
        ] as any,
      });

      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef, null, "mcp:srv-1:mcp-test"),
      );
      expect(result.current.selectedPrompt).toEqual(
        expect.objectContaining({ id: "mcp:srv-1:mcp-test", isMcp: true }),
      );
    });

    it("returns null for unknown initialSelectedPromptId", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef, null, "non-existent-prompt"),
      );
      expect(result.current.selectedPrompt).toBeNull();
    });

    it("initializes selectedAssistant from assistant id", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef, null, undefined, "a1"),
      );
      expect(result.current.selectedAssistant).toEqual(SAMPLE_ASSISTANTS[0]);
    });

    it("returns null for unknown initialSelectedAssistantId", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef, null, undefined, "unknown-asst"),
      );
      expect(result.current.selectedAssistant).toBeNull();
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

  describe("knowledgebase command detection (#)", () => {
    it("opens command palette when input starts with #", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef, null, undefined, undefined, true, undefined, undefined, undefined, SAMPLE_KNOWLEDGEBASES),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("#", 1));
      });

      expect(result.current.openTrigger).toBe("#");
    });

    it("shows all knowledgebases when query is empty (#)", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef, null, undefined, undefined, true, undefined, undefined, undefined, SAMPLE_KNOWLEDGEBASES),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("#", 1));
      });

      expect(result.current.filteredItems).toHaveLength(
        SAMPLE_KNOWLEDGEBASES.length,
      );
    });

    it("filters knowledgebases by name match", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef, null, undefined, undefined, true, undefined, undefined, undefined, SAMPLE_KNOWLEDGEBASES),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("#proj", 5));
      });

      expect(result.current.filteredItems).toHaveLength(1);
      expect((result.current.filteredItems[0] as any).name).toBe(
        "Project Docs",
      );
    });

    it("filters knowledgebases by description match", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef, null, undefined, undefined, true, undefined, undefined, undefined, SAMPLE_KNOWLEDGEBASES),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("#api", 4));
      });

      expect(result.current.filteredItems).toHaveLength(1);
      expect((result.current.filteredItems[0] as any).name).toBe(
        "API Reference",
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

    it("removes the # trigger and sets selectedKnowledgebase", () => {
      const setInput = vi.fn();
      const onSelectKnowledgebase = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands(
          "#proj",
          setInput,
          textareaRef,
          null,
          undefined,
          undefined,
          true,
          undefined,
          undefined,
          onSelectKnowledgebase,
          SAMPLE_KNOWLEDGEBASES,
        ),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("#proj", 5));
      });

      act(() => {
        result.current.handleSelect(SAMPLE_KNOWLEDGEBASES[0]);
      });

      expect(setInput).toHaveBeenLastCalledWith("");
      expect(result.current.selectedKnowledgebase).toEqual(SAMPLE_KNOWLEDGEBASES[0]);
      expect(onSelectKnowledgebase).toHaveBeenCalledWith(SAMPLE_KNOWLEDGEBASES[0]);
      expect(result.current.openTrigger).toBeNull();
    });

    it("selects a skill item and calls onSelectSkill", () => {
      const setInput = vi.fn();
      const onSelectSkill = vi.fn();
      const sampleSkill: any = {
        id: "sk-1",
        name: "code-review",
        displayName: "Code Review",
        description: "Review code",
        isEnabled: true,
        isSkill: true,
      };

      const { result } = renderHook(() =>
        useMentionCommands(
          "/code",
          setInput,
          textareaRef,
          null,
          undefined,
          undefined,
          true,
          undefined,
          onSelectSkill,
        ),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/code", 5));
      });

      act(() => {
        result.current.handleSelect(sampleSkill);
      });

      expect(onSelectSkill).toHaveBeenCalledWith(sampleSkill);
      expect(result.current.openTrigger).toBeNull();
    });

    it("focuses textarea after selection if ref is attached", () => {
      vi.useFakeTimers();
      const fakeTextarea = {
        focus: vi.fn(),
        setSelectionRange: vi.fn(),
      } as unknown as HTMLTextAreaElement;
      const ref = { current: fakeTextarea };

      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("/sum", setInput, ref),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/sum", 4));
      });

      act(() => {
        result.current.handleSelect(SAMPLE_PROMPTS[0]);
        vi.runAllTimers();
      });

      expect(fakeTextarea.focus).toHaveBeenCalled();
      expect(fakeTextarea.setSelectionRange).toHaveBeenCalledWith(0, 0);
      vi.useRealTimers();
    });

    it("does nothing if openTrigger is null", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleSelect(SAMPLE_PROMPTS[0]);
      });

      expect(setInput).not.toHaveBeenCalled();
    });
  });

  describe("handleKeyDown", () => {
    it("returns false if openTrigger is null", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      let handled = false;
      act(() => {
        handled = result.current.handleKeyDown(makeKeyEvent("ArrowDown"));
      });
      expect(handled).toBe(false);
    });

    it("navigates down and wraps around with ArrowDown", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      const initialIndex = result.current.selectedIndex;
      act(() => {
        const handled = result.current.handleKeyDown(makeKeyEvent("ArrowDown"));
        expect(handled).toBe(true);
      });
      expect(result.current.selectedIndex).toBe(initialIndex + 1);
    });

    it("navigates up and wraps around with ArrowUp", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      act(() => {
        const handled = result.current.handleKeyDown(makeKeyEvent("ArrowUp"));
        expect(handled).toBe(true);
      });
      expect(result.current.selectedIndex).toBe(result.current.filteredItems.length - 1);
    });

    it("selects current item with Enter", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("/sum", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/sum", 4));
      });

      act(() => {
        const handled = result.current.handleKeyDown(makeKeyEvent("Enter"));
        expect(handled).toBe(true);
      });

      expect(result.current.selectedPrompt).toEqual(
        expect.objectContaining({ id: SAMPLE_PROMPTS[0].id }),
      );
    });

    it("closes the palette with Escape", () => {
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
        const handled = result.current.handleKeyDown(makeKeyEvent("Escape"));
        expect(handled).toBe(true);
      });
      expect(result.current.openTrigger).toBeNull();
    });

    it("returns false for unhandled keys", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      let handled = true;
      act(() => {
        handled = result.current.handleKeyDown(makeKeyEvent("Tab"));
      });
      expect(handled).toBe(false);
    });
  });

  describe("skill filtering and line position detection", () => {
    it("filters enabled skills by name, displayName, or description", () => {
      const sampleSkills: any = [
        {
          id: "sk-1",
          name: "python-helper",
          displayName: "Python Helper",
          description: "Assists with python code",
          enabled: true,
        },
        {
          id: "sk-2",
          name: "disabled-skill",
          displayName: "Disabled Skill",
          description: "Should not appear",
          enabled: false,
        },
      ];

      useAppStore.setState({ skills: sampleSkills as any });
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/python", 7));
      });

      expect(result.current.filteredItems).toHaveLength(1);
      expect((result.current.filteredItems[0] as any).name).toBe("python-helper");
    });

    it("does not open trigger when preceded by non-whitespace character", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("abc/test", 8));
      });

      expect(result.current.openTrigger).toBeNull();
    });

    it("closes trigger when newline exists after trigger", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/foo\nbar", 8));
      });

      expect(result.current.openTrigger).toBeNull();
    });

    it("returns empty array for unknown openTrigger", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.setOpenTrigger("?" as any);
      });

      expect(result.current.filteredItems).toEqual([]);
    });
  });

  describe("MCP prompt filtering", () => {
    const SAMPLE_MCP_PROMPTS = [
      {
        serverId: "s1",
        serverName: "Server 1",
        name: "prompt1",
        description: "Prompt 1",
      },
      {
        serverId: "s2",
        serverName: "Server 2",
        name: "prompt2",
        description: "Prompt 2",
      },
    ];

    beforeEach(() => {
      useAppStore.setState({ mcpPrompts: SAMPLE_MCP_PROMPTS as any });
    });

    it("filters MCP prompts by selectedServerIds", () => {
      const setInput = vi.fn();
      const selectedServerIds = new Set(["s1"]);
      const { result } = renderHook(() =>
        useMentionCommands(
          "",
          setInput,
          textareaRef,
          null,
          undefined,
          undefined,
          true,
          selectedServerIds,
        ),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      // Should show local prompts + MCP prompts from s1
      const mcpItems = result.current.filteredItems.filter((i: any) => i.isMcp);
      expect(mcpItems).toHaveLength(1);
      expect(mcpItems[0].title).toBe("prompt1");
    });

    it("shows no MCP prompts if selectedServerIds is provided but empty", () => {
      const setInput = vi.fn();
      const selectedServerIds = new Set<string>();
      const { result } = renderHook(() =>
        useMentionCommands(
          "",
          setInput,
          textareaRef,
          null,
          undefined,
          undefined,
          true,
          selectedServerIds,
        ),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      const mcpItems = result.current.filteredItems.filter((i: any) => i.isMcp);
      expect(mcpItems).toHaveLength(0);
    });

    it("shows all MCP prompts if selectedServerIds is not provided (backward compatibility)", () => {
      const setInput = vi.fn();
      const { result } = renderHook(() =>
        useMentionCommands("", setInput, textareaRef),
      );

      act(() => {
        result.current.handleInputChange(makeInputEvent("/", 1));
      });

      const mcpItems = result.current.filteredItems.filter((i: any) => i.isMcp);
      expect(mcpItems).toHaveLength(SAMPLE_MCP_PROMPTS.length);
    });
  });
});


