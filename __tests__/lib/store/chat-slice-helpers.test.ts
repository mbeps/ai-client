import { describe, expect, it } from "vitest";
import { buildChatAfterSubtreeRemoval } from "@/lib/store/slices/chat/build-chat-after-subtree-removal";
import { buildChatWithCurrentLeaf } from "@/lib/store/slices/chat/build-chat-with-current-leaf";
import { buildChatWithInsertedMessage } from "@/lib/store/slices/chat/build-chat-with-inserted-message";
import { buildChatWithKnowledgebase } from "@/lib/store/slices/chat/build-chat-with-knowledgebase";
import { buildChatWithMessageMetadata } from "@/lib/store/slices/chat/build-chat-with-message-metadata";
import { buildChatWithMovedProject } from "@/lib/store/slices/chat/build-chat-with-moved-project";
import { buildChatWithRenamedTitle } from "@/lib/store/slices/chat/build-chat-with-renamed-title";
import { buildChatWithUpdatedAttachments } from "@/lib/store/slices/chat/build-chat-with-updated-attachments";
import { buildHydratedChat } from "@/lib/store/slices/chat/build-hydrated-chat";
import { buildNewChatFromRow } from "@/lib/store/slices/chat/build-new-chat-from-row";
import { createChatRollbackState } from "@/lib/store/slices/chat/create-chat-rollback-state";
import { groupMessagesByChatId } from "@/lib/store/slices/chat/group-messages-by-chat-id";
import { initializeChatsFromRows } from "@/lib/store/slices/chat/initialize-chats-from-rows";
import { mapAttachmentRowToAttachment } from "@/lib/store/slices/chat/map-attachment-row-to-attachment";
import { mergeUpsertedChat } from "@/lib/store/slices/chat/merge-upserted-chat";
import { populateMessagesAndTree } from "@/lib/store/slices/chat/populate-messages-and-tree";
import { resolveCreatedAt } from "@/lib/store/slices/chat/resolve-created-at";
import { resolveCurrentLeafId } from "@/lib/store/slices/chat/resolve-current-leaf-id";
import type { Attachment } from "@/types/attachment/attachment";
import type { AttachmentRow } from "@/types/attachment/attachment-row";
import type { AddMessageParams } from "@/types/chat/add-message-params";
import type { Chat } from "@/types/chat/chat";
import type { ChatRow } from "@/types/chat/chat-row";
import type { MessageRow } from "@/types/message/message-row";

describe("chat store pure helpers", () => {
  describe("groupMessagesByChatId", () => {
    it("returns an empty map for empty message rows", () => {
      const result = groupMessagesByChatId([]);
      expect(result.size).toBe(0);
    });

    it("groups single and multiple messages by chat ID correctly", () => {
      const rows = [
        { id: "m1", chatId: "c1" } as MessageRow,
        { id: "m2", chatId: "c2" } as MessageRow,
        { id: "m3", chatId: "c1" } as MessageRow,
      ];
      const result = groupMessagesByChatId(rows);
      expect(result.size).toBe(2);
      expect(result.get("c1")?.map((m) => m.id)).toEqual(["m1", "m3"]);
      expect(result.get("c2")?.map((m) => m.id)).toEqual(["m2"]);
    });
  });

  describe("mapAttachmentRowToAttachment", () => {
    it("maps image mime types to 'image'", () => {
      const row: AttachmentRow = {
        id: "att-1",
        messageId: "m1",
        name: "test.png",
        mimeType: "image/png",
        size: 1024,
        key: "uploads/test.png",
        extractedText: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const att = mapAttachmentRowToAttachment(row);
      expect(att.type).toBe("image");
      expect(att.name).toBe("test.png");
      expect(att.mimeType).toBe("image/png");
      expect(att.sizeBytes).toBe(1024);
      expect(att.key).toBe("uploads/test.png");
      expect(att.dataUrl).toBe("");
      expect(att.extractedText).toBeUndefined();
    });

    it("maps spreadsheet mime types to 'spreadsheet'", () => {
      const row: AttachmentRow = {
        id: "att-2",
        messageId: "m1",
        name: "sheet.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 2048,
        key: "uploads/sheet.xlsx",
        extractedText: "Some sheet content",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const att = mapAttachmentRowToAttachment(row);
      expect(att.type).toBe("spreadsheet");
      expect(att.extractedText).toBe("Some sheet content");
    });

    it("maps document mime types to 'document'", () => {
      const row: AttachmentRow = {
        id: "att-3",
        messageId: "m1",
        name: "doc.pdf",
        mimeType: "application/pdf",
        size: 4096,
        key: "uploads/doc.pdf",
        extractedText: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const att = mapAttachmentRowToAttachment(row);
      expect(att.type).toBe("document");
      expect(att.extractedText).toBeUndefined();
    });
  });

  describe("resolveCreatedAt", () => {
    it("returns a Date instance when rowDate is a Date", () => {
      const date = new Date("2026-01-01T00:00:00Z");
      expect(resolveCreatedAt(date, undefined)).toEqual(date);
    });

    it("returns a Date instance when rowDate is a string", () => {
      const dateStr = "2026-02-01T12:00:00Z";
      expect(resolveCreatedAt(dateStr, undefined)).toEqual(new Date(dateStr));
    });

    it("falls back to existingDate when rowDate is null or undefined", () => {
      const fallback = new Date("2025-12-01T00:00:00Z");
      expect(resolveCreatedAt(null, fallback)).toBe(fallback);
      expect(resolveCreatedAt(undefined, fallback)).toBe(fallback);
    });

    it("returns undefined when both rowDate and existingDate are absent", () => {
      expect(resolveCreatedAt(null, undefined)).toBeUndefined();
      expect(resolveCreatedAt(undefined, undefined)).toBeUndefined();
    });
  });

  describe("resolveCurrentLeafId", () => {
    it("prioritizes rowLeafId over existingLeafId when incoming messages exist", () => {
      expect(resolveCurrentLeafId("row-leaf", "exist-leaf", true)).toBe(
        "row-leaf",
      );
      expect(resolveCurrentLeafId(null, "exist-leaf", true)).toBe("exist-leaf");
      expect(resolveCurrentLeafId(undefined, undefined, true)).toBeNull();
    });

    it("prioritizes existingLeafId over rowLeafId when incoming messages do not exist", () => {
      expect(resolveCurrentLeafId("row-leaf", "exist-leaf", false)).toBe(
        "exist-leaf",
      );
      expect(resolveCurrentLeafId("row-leaf", null, false)).toBe("row-leaf");
      expect(resolveCurrentLeafId(undefined, undefined, false)).toBeNull();
    });
  });

  describe("buildHydratedChat", () => {
    const baseRow: ChatRow = {
      id: "chat-1",
      title: "Test Chat",
      projectId: "proj-1",
      agentId: "asst-1",
      knowledgebaseId: "kb-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      currentLeafId: "leaf-1",
    };

    it("hydrates a chat row with all optional fields provided", () => {
      const chat = buildHydratedChat(baseRow, undefined, false);
      expect(chat.id).toBe("chat-1");
      expect(chat.title).toBe("Test Chat");
      expect(chat.projectId).toBe("proj-1");
      expect(chat.assistantId).toBe("asst-1");
      expect(chat.knowledgebaseId).toBe("kb-1");
      expect(chat.currentLeafId).toBe("leaf-1");
      expect(chat.messages).toEqual({});
    });

    it("handles null projectId, assistantId, and knowledgebaseId", () => {
      const row: ChatRow = {
        ...baseRow,
        projectId: null,
        agentId: null,
        knowledgebaseId: null,
      };
      const chat = buildHydratedChat(row, undefined, false);
      expect(chat.projectId).toBeUndefined();
      expect(chat.assistantId).toBeUndefined();
      expect(chat.knowledgebaseId).toBeNull();
    });

    it("preserves existing messages when hasIncomingMsgs is false", () => {
      const existing: Chat = {
        id: "chat-1",
        title: "Old Chat",
        updatedAt: new Date(),
        messages: {
          m1: {
            id: "m1",
            role: "user",
            content: "hello",
            createdAt: new Date(),
            parentId: null,
            childrenIds: [],
          },
        },
        currentLeafId: "m1",
      };
      const chat = buildHydratedChat(baseRow, existing, false);
      expect(chat.messages).toEqual(existing.messages);
      expect(chat.currentLeafId).toBe("m1");
    });

    it("resets messages when hasIncomingMsgs is true", () => {
      const existing: Chat = {
        id: "chat-1",
        title: "Old Chat",
        updatedAt: new Date(),
        messages: {
          m1: {
            id: "m1",
            role: "user",
            content: "hello",
            createdAt: new Date(),
            parentId: null,
            childrenIds: [],
          },
        },
        currentLeafId: "m1",
      };
      const chat = buildHydratedChat(baseRow, existing, true);
      expect(chat.messages).toEqual({});
      expect(chat.currentLeafId).toBe("leaf-1");
    });
  });

  describe("initializeChatsFromRows", () => {
    it("returns an empty object when rows is empty", () => {
      const result = initializeChatsFromRows([], {}, new Map());
      expect(result).toEqual({});
    });

    it("hydrates multiple rows correctly", () => {
      const rows: ChatRow[] = [
        {
          id: "c1",
          title: "Chat 1",
          projectId: null,
          assistantId: null,
          knowledgebaseId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          currentLeafId: null,
        },
        {
          id: "c2",
          title: "Chat 2",
          projectId: "p1",
          assistantId: null,
          knowledgebaseId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          currentLeafId: "leaf-c2",
        },
      ];
      const messageMap = new Map<string, MessageRow[]>([
        ["c2", [{ id: "m2", chatId: "c2" } as MessageRow]],
      ]);
      const result = initializeChatsFromRows(rows, {}, messageMap);
      expect(Object.keys(result)).toEqual(["c1", "c2"]);
      expect(result.c1.title).toBe("Chat 1");
      expect(result.c2.title).toBe("Chat 2");
      expect(result.c2.projectId).toBe("p1");
    });
  });

  describe("populateMessagesAndTree", () => {
    it("gracefully handles unknown chat ids and empty attachmentRows", () => {
      const chats: Record<string, Chat> = {};
      const messageRows: MessageRow[] = [
        {
          id: "m1",
          chatId: "unknown-chat",
          role: "user",
          content: "Hello",
          parentId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: null,
          reasoning: null,
        },
      ];
      expect(() =>
        populateMessagesAndTree(chats, messageRows, undefined),
      ).not.toThrow();
    });

    it("populates messages, attaches matching attachments, and builds child links", () => {
      const chats: Record<string, Chat> = {
        c1: {
          id: "c1",
          title: "Chat 1",
          updatedAt: new Date(),
          messages: {},
          currentLeafId: null,
        },
      };
      const messageRows: MessageRow[] = [
        {
          id: "m1",
          chatId: "c1",
          role: "user",
          content: "First",
          parentId: null,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
          metadata: null,
          reasoning: null,
        },
        {
          id: "m2",
          chatId: "c1",
          role: "assistant",
          content: "Second",
          parentId: "m1",
          createdAt: new Date("2026-01-01T00:01:00Z"),
          updatedAt: new Date("2026-01-01T00:01:00Z"),
          metadata: null,
          reasoning: null,
        },
        {
          id: "m3",
          chatId: "c1",
          role: "user",
          content: "Orphan",
          parentId: "non-existent-parent",
          createdAt: new Date("2026-01-01T00:02:00Z"),
          updatedAt: new Date("2026-01-01T00:02:00Z"),
          metadata: null,
          reasoning: null,
        },
        {
          id: "m4",
          chatId: "other-chat",
          role: "user",
          content: "Different chat",
          parentId: "some-parent",
          createdAt: new Date("2026-01-01T00:03:00Z"),
          updatedAt: new Date("2026-01-01T00:03:00Z"),
          metadata: null,
          reasoning: null,
        },
      ];
      const attachmentRows: AttachmentRow[] = [
        {
          id: "att-1",
          messageId: "m1",
          name: "file.txt",
          mimeType: "text/plain",
          size: 100,
          key: "key-1",
          extractedText: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      populateMessagesAndTree(chats, messageRows, attachmentRows);

      expect(chats.c1.messages.m1).toBeDefined();
      expect(chats.c1.messages.m1.attachments).toHaveLength(1);
      expect(chats.c1.messages.m1.childrenIds).toEqual(["m2"]);
      expect(chats.c1.messages.m2.childrenIds).toEqual([]);
      expect(chats.c1.messages.m3.childrenIds).toEqual([]);
    });
  });

  describe("buildChatWithInsertedMessage", () => {
    it("inserts a new message and updates currentLeafId and updatedAt", () => {
      const chat: Chat = {
        id: "c1",
        title: "Test Chat",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        messages: {},
        currentLeafId: null,
      };
      const params: AddMessageParams = {
        role: "user",
        content: "Hello world",
        parentId: null,
      };

      const updated = buildChatWithInsertedMessage(chat, params, "new-id");

      expect(updated.currentLeafId).toBe("new-id");
      expect(updated.messages["new-id"]).toBeDefined();
      expect(updated.messages["new-id"].content).toBe("Hello world");
      expect(updated.messages["new-id"].metadata).toBeNull();
      expect(updated.messages["new-id"].reasoning).toBeUndefined();
      expect(updated.messages["new-id"].attachments).toEqual([]);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        chat.updatedAt.getTime(),
      );
    });

    it("respects provided optional parameters (metadata, reasoning, attachments)", () => {
      const chat: Chat = {
        id: "c1",
        title: "Test Chat",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        messages: {},
        currentLeafId: null,
      };
      const attachments: Attachment[] = [
        {
          id: "att-1",
          type: "image",
          name: "pic.png",
          mimeType: "image/png",
          sizeBytes: 500,
          dataUrl: "",
          key: "key-1",
        },
      ];
      const params: AddMessageParams = {
        role: "assistant",
        content: "Answer",
        parentId: null,
        metadata: JSON.stringify({ model: "gpt-4o" }),
        reasoning: "Step 1...",
        attachments,
      };

      const updated = buildChatWithInsertedMessage(chat, params, "msg-2");

      expect(updated.messages["msg-2"].metadata).toBe(
        JSON.stringify({ model: "gpt-4o" }),
      );
      expect(updated.messages["msg-2"].reasoning).toBe("Step 1...");
      expect(updated.messages["msg-2"].attachments).toEqual(attachments);
    });
  });

  describe("buildChatAfterSubtreeRemoval", () => {
    it("removes target message and resets currentLeafId when parent is null", () => {
      const chat: Chat = {
        id: "c1",
        title: "Test Chat",
        updatedAt: new Date(),
        messages: {
          root: {
            id: "root",
            role: "user",
            content: "Root",
            createdAt: new Date(),
            parentId: null,
            childrenIds: [],
          },
        },
        currentLeafId: "root",
      };

      const { updatedChat, newLeafId } = buildChatAfterSubtreeRemoval(
        chat,
        "root",
      );
      expect(updatedChat.messages.root).toBeUndefined();
      expect(updatedChat.currentLeafId).toBeNull();
      expect(newLeafId).toBeNull();
    });

    it("removes child message and updates currentLeafId to deepest leaf of parent", () => {
      const chat: Chat = {
        id: "c1",
        title: "Test Chat",
        updatedAt: new Date(),
        messages: {
          root: {
            id: "root",
            role: "user",
            content: "Root",
            createdAt: new Date(),
            parentId: null,
            childrenIds: ["child1"],
          },
          child1: {
            id: "child1",
            role: "assistant",
            content: "Child 1",
            createdAt: new Date(),
            parentId: "root",
            childrenIds: [],
          },
        },
        currentLeafId: "child1",
      };

      const { updatedChat, newLeafId } = buildChatAfterSubtreeRemoval(
        chat,
        "child1",
      );
      expect(updatedChat.messages.child1).toBeUndefined();
      expect(updatedChat.messages.root.childrenIds).toEqual([]);
      expect(updatedChat.currentLeafId).toBe("root");
      expect(newLeafId).toBe("root");
    });
  });

  describe("buildChatWithUpdatedAttachments", () => {
    it("returns null if message does not exist in chat", () => {
      const chat: Chat = {
        id: "c1",
        title: "Test Chat",
        updatedAt: new Date(),
        messages: {},
        currentLeafId: null,
      };
      const result = buildChatWithUpdatedAttachments(chat, "m-missing", []);
      expect(result).toBeNull();
    });

    it("updates matching attachments and preserves unmatching ones", () => {
      const existingAttachment: Attachment = {
        id: "att-1",
        type: "document",
        name: "old-name.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        dataUrl: "",
        key: "old-key",
      };
      const unmodifiedAttachment: Attachment = {
        id: "att-2",
        type: "image",
        name: "pic.png",
        mimeType: "image/png",
        sizeBytes: 200,
        dataUrl: "",
        key: "pic-key",
      };
      const chat: Chat = {
        id: "c1",
        title: "Test Chat",
        updatedAt: new Date(),
        messages: {
          m1: {
            id: "m1",
            role: "user",
            content: "Check files",
            createdAt: new Date(),
            parentId: null,
            childrenIds: [],
            attachments: [existingAttachment, unmodifiedAttachment],
          },
        },
        currentLeafId: "m1",
      };

      const updatedAttachments: Attachment[] = [
        {
          id: "att-1",
          type: "document",
          name: "updated-name.pdf",
          mimeType: "application/pdf",
          sizeBytes: 150,
          dataUrl: "data:application/pdf;base64,abc",
          key: "new-key",
        },
      ];

      const result = buildChatWithUpdatedAttachments(
        chat,
        "m1",
        updatedAttachments,
      );
      expect(result).not.toBeNull();
      const updatedList = result!.messages.m1.attachments ?? [];
      expect(updatedList[0].name).toBe("updated-name.pdf");
      expect(updatedList[0].sizeBytes).toBe(150);
      expect(updatedList[1].name).toBe("pic.png");
    });

    it("handles message with undefined attachments array", () => {
      const chat: Chat = {
        id: "c1",
        title: "Test Chat",
        updatedAt: new Date(),
        messages: {
          m1: {
            id: "m1",
            role: "user",
            content: "Check files",
            createdAt: new Date(),
            parentId: null,
            childrenIds: [],
            attachments: undefined,
          },
        },
        currentLeafId: "m1",
      };

      const result = buildChatWithUpdatedAttachments(chat, "m1", []);
      expect(result).not.toBeNull();
      expect(result!.messages.m1.attachments).toEqual([]);
    });
  });

  describe("mergeUpsertedChat", () => {
    it("merges incoming chat when it has messages", () => {
      const existing: Chat = {
        id: "c1",
        title: "Old Chat",
        updatedAt: new Date(),
        messages: {
          oldMsg: {
            id: "oldMsg",
            role: "user",
            content: "old",
            createdAt: new Date(),
            parentId: null,
            childrenIds: [],
          },
        },
        currentLeafId: "oldMsg",
      };
      const incoming: Chat = {
        id: "c1",
        title: "New Chat",
        updatedAt: new Date(),
        messages: {
          newMsg: {
            id: "newMsg",
            role: "user",
            content: "new",
            createdAt: new Date(),
            parentId: null,
            childrenIds: [],
          },
        },
        currentLeafId: "newMsg",
      };

      const merged = mergeUpsertedChat(existing, incoming);
      expect(merged.title).toBe("New Chat");
      expect(merged.messages).toEqual(incoming.messages);
      expect(merged.currentLeafId).toBe("newMsg");
    });

    it("preserves existing messages and leaf id when incoming messages is empty", () => {
      const existing: Chat = {
        id: "c1",
        title: "Old Chat",
        updatedAt: new Date(),
        messages: {
          oldMsg: {
            id: "oldMsg",
            role: "user",
            content: "old",
            createdAt: new Date(),
            parentId: null,
            childrenIds: [],
          },
        },
        currentLeafId: "oldMsg",
      };
      const incoming: Chat = {
        id: "c1",
        title: "Updated Title",
        updatedAt: new Date(),
        messages: {},
        currentLeafId: null,
      };

      const merged = mergeUpsertedChat(existing, incoming);
      expect(merged.title).toBe("Updated Title");
      expect(merged.messages).toEqual(existing.messages);
      expect(merged.currentLeafId).toBe("oldMsg");
    });

    it("falls back to incoming currentLeafId or null when existing has none", () => {
      const incomingWithLeaf: Chat = {
        id: "c1",
        title: "Incoming",
        updatedAt: new Date(),
        messages: {},
        currentLeafId: "leaf-inc",
      };
      const merged1 = mergeUpsertedChat(undefined, incomingWithLeaf);
      expect(merged1.currentLeafId).toBe("leaf-inc");

      const incomingNoLeaf: Chat = {
        id: "c2",
        title: "Incoming 2",
        updatedAt: new Date(),
        messages: {},
        currentLeafId: null,
      };
      const merged2 = mergeUpsertedChat(undefined, incomingNoLeaf);
      expect(merged2.currentLeafId).toBeNull();
    });
  });

  describe("buildNewChatFromRow", () => {
    it("constructs a new Chat from a database row", () => {
      const row: ChatRow = {
        id: "c-new",
        title: "Brand New Chat",
        projectId: "p-1",
        agentId: "a-1",
        knowledgebaseId: "kb-1",
        createdAt: new Date("2026-03-01T00:00:00Z"),
        updatedAt: new Date("2026-03-01T00:00:00Z"),
        currentLeafId: "l-1",
      };

      const chat = buildNewChatFromRow(row);
      expect(chat.id).toBe("c-new");
      expect(chat.title).toBe("Brand New Chat");
      expect(chat.projectId).toBe("p-1");
      expect(chat.assistantId).toBe("a-1");
      expect(chat.knowledgebaseId).toBe("kb-1");
      expect(chat.createdAt).toEqual(new Date("2026-03-01T00:00:00Z"));
      expect(chat.updatedAt).toEqual(new Date("2026-03-01T00:00:00Z"));
      expect(chat.messages).toEqual({});
      expect(chat.currentLeafId).toBe("l-1");
    });

    it("handles optional null fields properly", () => {
      const row: ChatRow = {
        id: "c-new-nulls",
        title: "Chat With Nulls",
        projectId: null,
        agentId: null,
        knowledgebaseId: null,
        createdAt: new Date("2026-03-01T00:00:00Z"),
        updatedAt: new Date("2026-03-01T00:00:00Z"),
        currentLeafId: null,
      };

      const chat = buildNewChatFromRow(row);
      expect(chat.projectId).toBeUndefined();
      expect(chat.assistantId).toBeUndefined();
      expect(chat.knowledgebaseId).toBeNull();
      expect(chat.currentLeafId).toBeNull();
    });
  });

  describe("buildChatWithRenamedTitle", () => {
    it("updates title and updatedAt timestamp", () => {
      const chat: Chat = {
        id: "c1",
        title: "Old Title",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        messages: {},
        currentLeafId: null,
      };
      const renamed = buildChatWithRenamedTitle(chat, "New Title");
      expect(renamed.title).toBe("New Title");
      expect(renamed.updatedAt.getTime()).toBeGreaterThan(
        chat.updatedAt.getTime(),
      );
    });
  });

  describe("buildChatWithMovedProject", () => {
    it("updates projectId and updatedAt timestamp", () => {
      const chat: Chat = {
        id: "c1",
        title: "Chat",
        projectId: "p-old",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        messages: {},
        currentLeafId: null,
      };
      const moved = buildChatWithMovedProject(chat, "p-new");
      expect(moved.projectId).toBe("p-new");
      expect(moved.updatedAt.getTime()).toBeGreaterThan(
        chat.updatedAt.getTime(),
      );
    });

    it("clears projectId when set to null", () => {
      const chat: Chat = {
        id: "c1",
        title: "Chat",
        projectId: "p-old",
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        messages: {},
        currentLeafId: null,
      };
      const movedNull = buildChatWithMovedProject(chat, null);
      expect(movedNull.projectId).toBeNull();
    });
  });

  describe("buildChatWithCurrentLeaf", () => {
    it("updates currentLeafId without modifying updatedAt", () => {
      const origDate = new Date("2026-01-01T00:00:00Z");
      const chat: Chat = {
        id: "c1",
        title: "Chat",
        updatedAt: origDate,
        messages: {},
        currentLeafId: "leaf-1",
      };
      const updated = buildChatWithCurrentLeaf(chat, "leaf-2");
      expect(updated.currentLeafId).toBe("leaf-2");
      expect(updated.updatedAt).toBe(origDate);
    });
  });

  describe("buildChatWithKnowledgebase", () => {
    it("updates knowledgebaseId", () => {
      const chat: Chat = {
        id: "c1",
        title: "Chat",
        knowledgebaseId: null,
        updatedAt: new Date(),
        messages: {},
        currentLeafId: null,
      };
      const updated = buildChatWithKnowledgebase(chat, "kb-123");
      expect(updated.knowledgebaseId).toBe("kb-123");
    });
  });

  describe("buildChatWithMessageMetadata", () => {
    it("returns null if target message does not exist", () => {
      const chat: Chat = {
        id: "c1",
        title: "Chat",
        updatedAt: new Date(),
        messages: {},
        currentLeafId: null,
      };
      expect(buildChatWithMessageMetadata(chat, "non-existent", "meta")).toBeNull();
    });

    it("updates metadata on existing message", () => {
      const chat: Chat = {
        id: "c1",
        title: "Chat",
        updatedAt: new Date(),
        messages: {
          m1: {
            id: "m1",
            role: "assistant",
            content: "hello",
            createdAt: new Date(),
            parentId: null,
            childrenIds: [],
            metadata: null,
          },
        },
        currentLeafId: "m1",
      };
      const updated = buildChatWithMessageMetadata(chat, "m1", '{"step": 1}');
      expect(updated).not.toBeNull();
      expect(updated!.messages.m1.metadata).toBe('{"step": 1}');
    });
  });

  describe("createChatRollbackState", () => {
    it("restores previous chat when previousChat is defined", () => {
      const previousChat: Chat = {
        id: "c1",
        title: "Original Chat",
        updatedAt: new Date(),
        messages: {},
        currentLeafId: null,
      };
      const currentChats: Record<string, Chat> = {
        c1: { ...previousChat, title: "Failed Rename" },
        c2: {
          id: "c2",
          title: "Other Chat",
          updatedAt: new Date(),
          messages: {},
          currentLeafId: null,
        },
      };

      const result = createChatRollbackState(currentChats, "c1", previousChat);
      expect(result.c1.title).toBe("Original Chat");
      expect(result.c2).toBeDefined();
    });

    it("returns unchanged chats when previousChat was undefined", () => {
      const currentChats: Record<string, Chat> = {
        c1: {
          id: "c1",
          title: "Chat 1",
          updatedAt: new Date(),
          messages: {},
          currentLeafId: null,
        },
      };

      const result = createChatRollbackState(currentChats, "c1", undefined);
      expect(result).toBe(currentChats);
    });
  });
});
