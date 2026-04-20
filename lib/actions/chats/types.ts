export interface ChatRow {
  id: string;
  title: string;
  userId: string;
  projectId: string | null;
  assistantId: string | null;
  currentLeafId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRow {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  parentId: string | null;
  metadata: string | null;
  createdAt: Date;
}

export interface AttachmentRow {
  id: string;
  messageId: string;
  userId: string;
  name: string;
  mimeType: string;
  size: number;
  key: string;
  createdAt: Date;
}

export interface ChatWithMessages extends ChatRow {
  messages: MessageRow[];
  attachments: AttachmentRow[];
}
