import { describe, expect, it } from "vitest";
import { buildChatFromRows } from "@/actions/chats/build-chat";

describe("buildChatFromRows", () => {
  it("builds chat object with zero messages", () => {
    const raw = {
      id: "chat-1",
      title: "Test Chat",
      projectId: null,
      assistantId: null,
      projectName: null,
      assistantName: null,
      updatedAt: new Date().toISOString(),
      currentLeafId: null,
      messages: [],
      attachments: [],
    };

    const chat = buildChatFromRows(raw);
    expect(chat.id).toBe("chat-1");
    expect(chat.title).toBe("Test Chat");
    expect(chat.messages).toEqual({});
    expect(chat.currentLeafId).toBeNull();
  });

  it("maps messages with tree relationships and attachment arrays", () => {
    const raw = {
      id: "chat-1",
      title: "Test Chat",
      projectId: "proj-1",
      assistantId: "asst-1",
      knowledgebaseId: "kb-1",
      projectName: "Project 1",
      assistantName: "Assistant 1",
      updatedAt: new Date().toISOString(),
      currentLeafId: "msg-2",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content: "Hello",
          createdAt: new Date(Date.now() - 1000).toISOString(),
          parentId: null,
          metadata: { custom: true },
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Hi there",
          createdAt: new Date().toISOString(),
          parentId: "msg-1",
          metadata: null,
        },
        {
          id: "msg-3",
          role: "user",
          content: "Orphan parent message",
          createdAt: new Date(Date.now() + 1000).toISOString(),
          parentId: "ghost-parent-id",
          metadata: null,
        },
      ],
      attachments: [
        {
          id: "att-1",
          messageId: "msg-1",
          name: "photo.png",
          mimeType: "image/png",
          size: 1024,
          key: "photos/photo.png",
        },
        {
          id: "att-1b",
          messageId: "msg-1",
          name: "document.pdf",
          mimeType: "application/pdf",
          size: 1024,
          key: "docs/document.pdf",
        },
        {
          id: "att-2",
          messageId: "msg-2",
          name: "data.xlsx",
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size: 2048,
          key: "sheets/data.xlsx",
        },
        {
          id: "att-3",
          messageId: null, // should be skipped
          name: "orphan.txt",
          mimeType: "text/plain",
          size: 512,
          key: "text/orphan.txt",
        },
        {
          id: "att-4",
          messageId: "non-existent-msg", // should be skipped
          name: "orphan2.txt",
          mimeType: "text/plain",
          size: 512,
          key: "text/orphan2.txt",
        },
      ],
    };

    const chat = buildChatFromRows(raw);
    expect(chat.messages["msg-1"].childrenIds).toEqual(["msg-2"]);
    expect(chat.messages["msg-2"].childrenIds).toEqual([]);
    expect(chat.messages["msg-1"].attachments).toHaveLength(2);
    expect(chat.messages["msg-1"].attachments[0].type).toBe("image");
    expect(chat.messages["msg-1"].attachments[1].type).toBe("document");
    expect(chat.messages["msg-2"].attachments[0].type).toBe("spreadsheet");
    expect(chat.projectId).toBe("proj-1");
    expect(chat.assistantId).toBe("asst-1");
    expect(chat.knowledgebaseId).toBe("kb-1");
  });
});
