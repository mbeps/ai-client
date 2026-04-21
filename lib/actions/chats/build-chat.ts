import type { Chat, Message, Attachment } from "@/lib/store";
import type { ChatWithMessages } from "./types";

export function buildChatFromRows(row: ChatWithMessages): Chat {
  const messages: Record<string, Message> = {};

  for (const m of row.messages) {
    messages[m.id] = {
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: new Date(m.createdAt),
      parentId: m.parentId,
      childrenIds: [],
      attachments: [],
      metadata: m.metadata ?? null,
    };
  }

  for (const m of row.messages) {
    if (m.parentId && messages[m.parentId]) {
      messages[m.parentId].childrenIds.push(m.id);
    }
  }

  for (const att of row.attachments) {
    const msg = messages[att.messageId];
    if (msg) {
      const isImage = att.mimeType.startsWith("image/");
      msg.attachments = msg.attachments || [];
      (msg.attachments as Attachment[]).push({
        id: att.id,
        type: isImage ? "image" : "document",
        name: att.name,
        mimeType: att.mimeType,
        sizeBytes: att.size,
        dataUrl: "",
        key: att.key,
      });
    }
  }

  return {
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    updatedAt: new Date(row.updatedAt),
    messages,
    currentLeafId: row.currentLeafId,
  };
}
