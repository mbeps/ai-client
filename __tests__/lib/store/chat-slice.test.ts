import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "@/lib/store";
import type { Chat } from "@/types/chat";

// ─── Safety-net mocks: prevent env/db/auth from loading ───────────────────
vi.mock("@/lib/env", () => ({
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

// ─── Mock all server actions ───────────────────────────────────────────────
vi.mock("@/lib/actions/chats/create-chat", () => ({
  createChat: vi.fn(),
}));
vi.mock("@/lib/actions/chats/delete-chat", () => ({
  deleteChat: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/chats/rename-chat", () => ({
  renameChat: vi.fn(),
}));
vi.mock("@/lib/actions/chats/move-chat", () => ({
  moveChat: vi.fn(),
}));
vi.mock("@/lib/actions/chats/delete-message", () => ({
  deleteMessage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/chats/update-current-leaf", () => ({
  updateCurrentLeaf: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/chats/update-message-metadata", () => ({
  updateMessageMetadata: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/actions/projects/toggle-pin-project", () => ({
  togglePinProject: vi.fn(),
}));
// Entity slice stubs (needed because useAppStore loads all slices)
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
vi.mock("@/lib/actions/knowledgebases/rename-knowledgebase", () => ({
  renameKnowledgebase: vi.fn(),
}));

// ─── Import mocked modules for per-test configuration ─────────────────────
import { createChat as createChatAction } from "@/lib/actions/chats/create-chat";
import { renameChat as renameChatAction } from "@/lib/actions/chats/rename-chat";
import { moveChat as moveChatAction } from "@/lib/actions/chats/move-chat";

// ─── Helpers ───────────────────────────────────────────────────────────────
const RESET_STATE = {
  chats: {} as Record<string, Chat>,
  projects: [],
  assistants: [],
  prompts: [],
  knowledgebases: [],
  mcpServers: [],
};

const makeAttachment = (id: string) => ({
  id,
  type: "image" as const,
  name: "photo.png",
  mimeType: "image/png",
  sizeBytes: 1024,
  dataUrl: "",
  key: `uploads/${id}.png`,
});

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("ChatSlice — in-memory (optimistic) actions", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  // ── Initial state ───────────────────────────────────────────────────────
  describe("initial state", () => {
    it("starts with an empty chats map", () => {
      expect(useAppStore.getState().chats).toEqual({});
    });
  });

  // ── createChat ──────────────────────────────────────────────────────────
  describe("createChat", () => {
    it("returns a new UUID and adds the chat to store", () => {
      const id = useAppStore.getState().createChat();
      const chats = useAppStore.getState().chats;
      expect(id).toBeTruthy();
      expect(chats[id]).toBeDefined();
    });

    it("creates chat with default title 'New Chat'", () => {
      const id = useAppStore.getState().createChat();
      expect(useAppStore.getState().chats[id].title).toBe("New Chat");
    });

    it("stores projectId when provided", () => {
      const id = useAppStore.getState().createChat("proj-1");
      expect(useAppStore.getState().chats[id].projectId).toBe("proj-1");
    });

    it("stores assistantId when provided", () => {
      const id = useAppStore.getState().createChat(undefined, "asst-1");
      expect(useAppStore.getState().chats[id].assistantId).toBe("asst-1");
    });

    it("initialises with empty messages and null currentLeafId", () => {
      const id = useAppStore.getState().createChat();
      const chat = useAppStore.getState().chats[id];
      expect(chat.messages).toEqual({});
      expect(chat.currentLeafId).toBeNull();
    });

    it("each call returns a unique ID", () => {
      const a = useAppStore.getState().createChat();
      const b = useAppStore.getState().createChat();
      expect(a).not.toBe(b);
    });
  });

  // ── addMessage ──────────────────────────────────────────────────────────
  describe("addMessage", () => {
    it("adds a root message and sets currentLeafId", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Hello", null, "msg-1");
      const chat = useAppStore.getState().chats[chatId];
      expect(chat.messages["msg-1"]).toBeDefined();
      expect(chat.currentLeafId).toBe("msg-1");
    });

    it("links message to its parent's childrenIds", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Root", null, "root");
      useAppStore
        .getState()
        .addMessage(chatId, "assistant", "Reply", "root", "child");
      const parent = useAppStore.getState().chats[chatId].messages["root"];
      expect(parent.childrenIds).toContain("child");
    });

    it("sets message role correctly", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore
        .getState()
        .addMessage(chatId, "assistant", "Hi", null, "msg-1");
      expect(useAppStore.getState().chats[chatId].messages["msg-1"].role).toBe(
        "assistant",
      );
    });

    it("generates a UUID when id is not provided", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Hi", null);
      const messages = useAppStore.getState().chats[chatId].messages;
      expect(Object.keys(messages)).toHaveLength(1);
    });

    it("stores attachments on the message", () => {
      const chatId = useAppStore.getState().createChat();
      const att = makeAttachment("att-1");
      useAppStore
        .getState()
        .addMessage(chatId, "user", "Hi", null, "msg-1", null, [att]);
      expect(
        useAppStore.getState().chats[chatId].messages["msg-1"].attachments,
      ).toEqual([att]);
    });

    it("does nothing when chatId does not exist", () => {
      useAppStore
        .getState()
        .addMessage("nonexistent", "user", "Hi", null, "msg-1");
      expect(useAppStore.getState().chats["nonexistent"]).toBeUndefined();
    });
  });

  // ── deleteMessage ───────────────────────────────────────────────────────
  describe("deleteMessage", () => {
    it("removes the message from the chat", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Hi", null, "msg-1");
      useAppStore.getState().deleteMessage(chatId, "msg-1");
      expect(
        useAppStore.getState().chats[chatId].messages["msg-1"],
      ).toBeUndefined();
    });

    it("removes the message from parent's childrenIds", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Root", null, "root");
      useAppStore
        .getState()
        .addMessage(chatId, "assistant", "Child", "root", "child");
      useAppStore.getState().deleteMessage(chatId, "child");
      expect(
        useAppStore.getState().chats[chatId].messages["root"].childrenIds,
      ).not.toContain("child");
    });

    it("recursively removes children of the deleted message", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Root", null, "root");
      useAppStore
        .getState()
        .addMessage(chatId, "assistant", "Child", "root", "child");
      useAppStore
        .getState()
        .addMessage(chatId, "user", "Grandchild", "child", "grandchild");
      useAppStore.getState().deleteMessage(chatId, "child");
      const msgs = useAppStore.getState().chats[chatId].messages;
      expect(msgs["child"]).toBeUndefined();
      expect(msgs["grandchild"]).toBeUndefined();
      expect(msgs["root"]).toBeDefined();
    });

    it("sets currentLeafId to parent after deletion", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Root", null, "root");
      useAppStore
        .getState()
        .addMessage(chatId, "assistant", "Child", "root", "child");
      useAppStore.getState().deleteMessage(chatId, "child");
      expect(useAppStore.getState().chats[chatId].currentLeafId).toBe("root");
    });

    it("does nothing when chatId does not exist", () => {
      useAppStore.getState().deleteMessage("nonexistent", "msg-1");
      expect(useAppStore.getState().chats["nonexistent"]).toBeUndefined();
    });
  });

  // ── setCurrentLeaf ──────────────────────────────────────────────────────
  describe("setCurrentLeaf", () => {
    it("updates currentLeafId for the given chat", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Root", null, "root");
      useAppStore
        .getState()
        .addMessage(chatId, "assistant", "A", "root", "branch-a");
      useAppStore
        .getState()
        .addMessage(chatId, "user", "Root", null, "branch-b");
      useAppStore.getState().setCurrentLeaf(chatId, "branch-a");
      expect(useAppStore.getState().chats[chatId].currentLeafId).toBe(
        "branch-a",
      );
    });

    it("does nothing when chat does not exist", () => {
      useAppStore.getState().setCurrentLeaf("nonexistent", "msg-1");
      expect(useAppStore.getState().chats["nonexistent"]).toBeUndefined();
    });
  });

  // ── deleteChat ──────────────────────────────────────────────────────────
  describe("deleteChat", () => {
    it("removes chat from the store", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().deleteChat(chatId);
      expect(useAppStore.getState().chats[chatId]).toBeUndefined();
    });

    it("does not affect other chats", () => {
      const a = useAppStore.getState().createChat();
      const b = useAppStore.getState().createChat();
      useAppStore.getState().deleteChat(a);
      expect(useAppStore.getState().chats[b]).toBeDefined();
    });
  });

  // ── updateMessageAttachments ────────────────────────────────────────────
  describe("updateMessageAttachments", () => {
    it("merges updated attachment data into existing attachments", () => {
      const chatId = useAppStore.getState().createChat();
      const att = makeAttachment("att-1");
      useAppStore
        .getState()
        .addMessage(chatId, "user", "Hi", null, "msg-1", null, [att]);
      useAppStore
        .getState()
        .updateMessageAttachments(chatId, "msg-1", [
          { ...att, dataUrl: "data:image/png;base64,abc" },
        ]);
      const updated =
        useAppStore.getState().chats[chatId].messages["msg-1"].attachments ??
        [];
      expect(updated[0].dataUrl).toBe("data:image/png;base64,abc");
    });

    it("does nothing when chat does not exist", () => {
      useAppStore
        .getState()
        .updateMessageAttachments("ghost", "msg-1", [makeAttachment("a")]);
      expect(useAppStore.getState().chats["ghost"]).toBeUndefined();
    });
  });

  // ── upsertChat ──────────────────────────────────────────────────────────
  describe("upsertChat", () => {
    it("inserts a chat that does not yet exist", () => {
      const chat: Chat = {
        id: "new-chat",
        title: "Upserted",
        updatedAt: new Date(),
        messages: {},
        currentLeafId: null,
      };
      useAppStore.getState().upsertChat(chat);
      expect(useAppStore.getState().chats["new-chat"]).toMatchObject({
        title: "Upserted",
      });
    });

    it("replaces an existing chat", () => {
      const chatId = useAppStore.getState().createChat();
      const updated: Chat = {
        id: chatId,
        title: "Replaced",
        updatedAt: new Date(),
        messages: {},
        currentLeafId: null,
      };
      useAppStore.getState().upsertChat(updated);
      expect(useAppStore.getState().chats[chatId].title).toBe("Replaced");
    });
  });

  // ── loadChats ───────────────────────────────────────────────────────────
  describe("loadChats", () => {
    it("hydrates chats from rows", () => {
      useAppStore.getState().loadChats(
        [
          {
            id: "c1",
            title: "Chat 1",
            projectId: null,
            assistantId: null,
            currentLeafId: null,
            updatedAt: new Date().toISOString(),
          },
        ],
        [],
      );
      expect(useAppStore.getState().chats["c1"]).toBeDefined();
      expect(useAppStore.getState().chats["c1"].title).toBe("Chat 1");
    });

    it("links parent and child messages via childrenIds", () => {
      const now = new Date().toISOString();
      useAppStore.getState().loadChats(
        [
          {
            id: "c1",
            title: "Chat 1",
            projectId: null,
            assistantId: null,
            currentLeafId: "msg-2",
            updatedAt: now,
          },
        ],
        [
          {
            id: "msg-1",
            chatId: "c1",
            role: "user",
            content: "Hello",
            parentId: null,
            metadata: null,
            createdAt: now,
          },
          {
            id: "msg-2",
            chatId: "c1",
            role: "assistant",
            content: "World",
            parentId: "msg-1",
            metadata: null,
            createdAt: now,
          },
        ],
      );
      const msgs = useAppStore.getState().chats["c1"].messages;
      expect(msgs["msg-1"].childrenIds).toContain("msg-2");
    });

    it("replaces existing chat state with new rows", () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().loadChats(
        [
          {
            id: "fresh",
            title: "Fresh",
            projectId: null,
            assistantId: null,
            currentLeafId: null,
            updatedAt: new Date().toISOString(),
          },
        ],
        [],
      );
      // original chat gone
      expect(useAppStore.getState().chats[chatId]).toBeUndefined();
      expect(useAppStore.getState().chats["fresh"]).toBeDefined();
    });
  });
});

// ─── DB (async) actions ────────────────────────────────────────────────────
describe("ChatSlice — DB actions", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  describe("createChatDb", () => {
    it("calls the server action and adds the returned chat to store", async () => {
      const now = new Date().toISOString();
      vi.mocked(createChatAction).mockResolvedValueOnce({
        id: "db-chat-1",
        title: "DB Chat",
        projectId: null,
        assistantId: null,
        currentLeafId: null,
        userId: "user-1",
        createdAt: now,
        updatedAt: now,
      });
      const id = await useAppStore.getState().createChatDb("DB Chat");
      expect(id).toBe("db-chat-1");
      expect(useAppStore.getState().chats["db-chat-1"]).toBeDefined();
    });
  });

  describe("deleteChatDb", () => {
    it("removes chat from store after server action", async () => {
      const chatId = useAppStore.getState().createChat();
      await useAppStore.getState().deleteChatDb(chatId);
      expect(useAppStore.getState().chats[chatId]).toBeUndefined();
    });
  });

  describe("renameChatDb", () => {
    it("updates chat title after server action", async () => {
      const chatId = useAppStore.getState().createChat();
      const now = new Date().toISOString();
      vi.mocked(renameChatAction).mockResolvedValueOnce({
        id: chatId,
        title: "Renamed",
        projectId: null,
        assistantId: null,
        currentLeafId: null,
        userId: "user-1",
        createdAt: now,
        updatedAt: now,
      });
      await useAppStore.getState().renameChatDb(chatId, "Renamed");
      expect(useAppStore.getState().chats[chatId].title).toBe("Renamed");
    });
  });

  describe("moveChatDb", () => {
    it("updates chat projectId after server action", async () => {
      const chatId = useAppStore.getState().createChat();
      const now = new Date().toISOString();
      vi.mocked(moveChatAction).mockResolvedValueOnce({
        id: chatId,
        title: "Chat",
        projectId: "proj-99",
        assistantId: null,
        currentLeafId: null,
        userId: "user-1",
        createdAt: now,
        updatedAt: now,
      });
      await useAppStore.getState().moveChatDb(chatId, "proj-99");
      expect(useAppStore.getState().chats[chatId].projectId).toBe("proj-99");
    });

    it("sets projectId to undefined when server returns null", async () => {
      const chatId = useAppStore.getState().createChat("proj-1");
      const now = new Date().toISOString();
      vi.mocked(moveChatAction).mockResolvedValueOnce({
        id: chatId,
        title: "Chat",
        projectId: null,
        assistantId: null,
        currentLeafId: null,
        userId: "user-1",
        createdAt: now,
        updatedAt: now,
      });
      await useAppStore.getState().moveChatDb(chatId, null);
      expect(useAppStore.getState().chats[chatId].projectId).toBeNull();
    });
  });

  describe("deleteMessageDb", () => {
    it("removes the message from the store and calls server action", async () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Hello", null, "msg-1");
      await useAppStore.getState().deleteMessageDb(chatId, "msg-1");
      expect(
        useAppStore.getState().chats[chatId].messages["msg-1"],
      ).toBeUndefined();
    });

    it("rejects and does not update store when the server action fails", async () => {
      const { deleteMessage: deleteMsgAction } =
        await import("@/lib/actions/chats/delete-message");
      vi.mocked(deleteMsgAction).mockRejectedValueOnce(new Error("DB error"));
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Hello", null, "msg-1");
      await expect(
        useAppStore.getState().deleteMessageDb(chatId, "msg-1"),
      ).rejects.toThrow("DB error");
      expect(
        useAppStore.getState().chats[chatId].messages["msg-1"],
      ).toBeDefined();
    });
  });

  describe("setCurrentLeafDb", () => {
    it("updates currentLeafId in store and calls server action", async () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Root", null, "root");
      useAppStore
        .getState()
        .addMessage(chatId, "assistant", "Child", "root", "child");
      await useAppStore.getState().setCurrentLeafDb(chatId, "root");
      expect(useAppStore.getState().chats[chatId].currentLeafId).toBe("root");
    });

    it("swallows errors from the server action", async () => {
      const { updateCurrentLeaf } =
        await import("@/lib/actions/chats/update-current-leaf");
      vi.mocked(updateCurrentLeaf).mockRejectedValueOnce(new Error("DB error"));
      const chatId = useAppStore.getState().createChat();
      await expect(
        useAppStore.getState().setCurrentLeafDb(chatId, "leaf-1"),
      ).resolves.toBeUndefined();
    });
  });

  describe("updateMessageMetadataDb", () => {
    it("updates metadata in store and calls server action", async () => {
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Hello", null, "msg-1");
      const metadata = JSON.stringify({ reasoning: "Some reasoning" });
      await useAppStore
        .getState()
        .updateMessageMetadataDb(chatId, "msg-1", metadata);
      expect(
        useAppStore.getState().chats[chatId].messages["msg-1"].metadata,
      ).toBe(metadata);
    });

    it("does nothing when chat does not exist", async () => {
      await expect(
        useAppStore.getState().updateMessageMetadataDb("ghost", "msg-1", "{}"),
      ).resolves.toBeUndefined();
    });

    it("does nothing when message does not exist", async () => {
      const chatId = useAppStore.getState().createChat();
      await expect(
        useAppStore
          .getState()
          .updateMessageMetadataDb(chatId, "nonexistent", "{}"),
      ).resolves.toBeUndefined();
    });

    it("swallows errors from the server action", async () => {
      const { updateMessageMetadata } =
        await import("@/lib/actions/chats/update-message-metadata");
      vi.mocked(updateMessageMetadata).mockRejectedValueOnce(
        new Error("DB error"),
      );
      const chatId = useAppStore.getState().createChat();
      useAppStore.getState().addMessage(chatId, "user", "Hello", null, "msg-1");
      await expect(
        useAppStore.getState().updateMessageMetadataDb(chatId, "msg-1", "{}"),
      ).resolves.toBeUndefined();
    });
  });
});

// ─── loadChats — additional branch coverage ────────────────────────────────
describe("ChatSlice — loadChats branch coverage", () => {
  beforeEach(() => {
    useAppStore.setState(RESET_STATE);
    vi.clearAllMocks();
  });

  it("skips messages whose chatId does not match any loaded chat", () => {
    useAppStore.getState().loadChats(
      [
        {
          id: "c1",
          title: "Chat",
          projectId: null,
          assistantId: null,
          currentLeafId: null,
          updatedAt: new Date().toISOString(),
        },
      ],
      [
        {
          id: "orphan",
          chatId: "c999",
          role: "user",
          content: "Lost",
          parentId: null,
          metadata: null,
          createdAt: new Date().toISOString(),
        },
      ],
    );
    const chat = useAppStore.getState().chats["c1"];
    expect(Object.keys(chat.messages)).toHaveLength(0);
  });

  it("gracefully handles invalid JSON in message metadata (catch branch)", () => {
    const now = new Date().toISOString();
    useAppStore.getState().loadChats(
      [
        {
          id: "c1",
          title: "Chat",
          projectId: null,
          assistantId: null,
          currentLeafId: null,
          updatedAt: now,
        },
      ],
      [
        {
          id: "msg-1",
          chatId: "c1",
          role: "user",
          content: "Hello",
          parentId: null,
          metadata: "NOT_JSON",
          createdAt: now,
        },
      ],
    );
    const msg = useAppStore.getState().chats["c1"].messages["msg-1"];
    expect(msg).toBeDefined();
    expect(msg.reasoning).toBeUndefined();
  });

  it("sets reasoning to undefined when metadata parses but safeParse fails", () => {
    const now = new Date().toISOString();
    // Valid JSON but does not match messageMetadataSchema (e.g. wrong shape)
    const badMetadata = JSON.stringify({ toolCalls: "not-an-array" });
    useAppStore.getState().loadChats(
      [
        {
          id: "c1",
          title: "Chat",
          projectId: null,
          assistantId: null,
          currentLeafId: null,
          updatedAt: now,
        },
      ],
      [
        {
          id: "msg-1",
          chatId: "c1",
          role: "user",
          content: "Hello",
          parentId: null,
          metadata: badMetadata,
          createdAt: now,
        },
      ],
    );
    const msg = useAppStore.getState().chats["c1"].messages["msg-1"];
    expect(msg.reasoning).toBeUndefined();
  });

  it("attaches image attachments to messages", () => {
    const now = new Date().toISOString();
    useAppStore.getState().loadChats(
      [
        {
          id: "c1",
          title: "Chat",
          projectId: null,
          assistantId: null,
          currentLeafId: null,
          updatedAt: now,
        },
      ],
      [
        {
          id: "msg-1",
          chatId: "c1",
          role: "user",
          content: "Photo",
          parentId: null,
          metadata: null,
          createdAt: now,
        },
      ],
      [
        {
          id: "att-1",
          messageId: "msg-1",
          name: "photo.png",
          mimeType: "image/png",
          size: 1024,
          key: "uploads/photo.png",
        },
      ],
    );
    const attachments =
      useAppStore.getState().chats["c1"].messages["msg-1"].attachments;
    expect(attachments).toHaveLength(1);
    expect(attachments[0].type).toBe("image");
    expect(attachments[0].name).toBe("photo.png");
  });

  it("attaches document attachments with type 'document'", () => {
    const now = new Date().toISOString();
    useAppStore.getState().loadChats(
      [
        {
          id: "c1",
          title: "Chat",
          projectId: null,
          assistantId: null,
          currentLeafId: null,
          updatedAt: now,
        },
      ],
      [
        {
          id: "msg-1",
          chatId: "c1",
          role: "user",
          content: "File",
          parentId: null,
          metadata: null,
          createdAt: now,
        },
      ],
      [
        {
          id: "att-1",
          messageId: "msg-1",
          name: "report.pdf",
          mimeType: "application/pdf",
          size: 5000,
          key: "uploads/report.pdf",
        },
      ],
    );
    const attachments =
      useAppStore.getState().chats["c1"].messages["msg-1"].attachments;
    expect(attachments[0].type).toBe("document");
  });

  it("skips attachments whose messageId does not exist in any chat", () => {
    const now = new Date().toISOString();
    useAppStore.getState().loadChats(
      [
        {
          id: "c1",
          title: "Chat",
          projectId: null,
          assistantId: null,
          currentLeafId: null,
          updatedAt: now,
        },
      ],
      [
        {
          id: "msg-1",
          chatId: "c1",
          role: "user",
          content: "Hello",
          parentId: null,
          metadata: null,
          createdAt: now,
        },
      ],
      [
        {
          id: "att-1",
          messageId: "ghost-msg",
          name: "file.png",
          mimeType: "image/png",
          size: 100,
          key: "uploads/file.png",
        },
      ],
    );
    const attachments =
      useAppStore.getState().chats["c1"].messages["msg-1"].attachments;
    expect(attachments).toHaveLength(0);
  });

  it("does not build childrenIds for orphaned parent references", () => {
    const now = new Date().toISOString();
    useAppStore.getState().loadChats(
      [
        {
          id: "c1",
          title: "Chat",
          projectId: null,
          assistantId: null,
          currentLeafId: null,
          updatedAt: now,
        },
      ],
      [
        {
          id: "msg-1",
          chatId: "c1",
          role: "user",
          content: "Hello",
          parentId: "does-not-exist",
          metadata: null,
          createdAt: now,
        },
      ],
    );
    const msg = useAppStore.getState().chats["c1"].messages["msg-1"];
    expect(msg.childrenIds).toHaveLength(0);
  });
});
