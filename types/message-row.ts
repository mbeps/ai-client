export interface MessageRow {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  parentId: string | null;
  metadata: string | null;
  createdAt: Date;
}
