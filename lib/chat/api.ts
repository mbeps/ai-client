export interface ChatRow {
  id: string;
  title: string;
  userId: string;
  projectId: string | null;
  assistantId: string | null;
  currentLeafId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRow {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system";
  content: string;
  parentId: string | null;
  createdAt: string;
}

export interface ChatWithMessages extends ChatRow {
  messages: MessageRow[];
}

export async function apiListChats(): Promise<ChatRow[]> {
  const res = await fetch("/api/chats");
  if (!res.ok) throw new Error("Failed to list chats");
  return res.json();
}

export async function apiCreateChat(
  title?: string,
  projectId?: string,
  assistantId?: string,
): Promise<ChatRow> {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, projectId, assistantId }),
  });
  if (!res.ok) throw new Error("Failed to create chat");
  return res.json();
}

export async function apiGetChat(chatId: string): Promise<ChatWithMessages> {
  const res = await fetch(`/api/chats/${chatId}`);
  if (!res.ok) throw new Error("Failed to load chat");
  return res.json();
}

export async function apiDeleteChat(chatId: string): Promise<void> {
  const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete chat");
}

export async function apiPersistMessage(
  chatId: string,
  msg: { id: string; role: string; content: string; parentId: string | null },
): Promise<MessageRow> {
  const res = await fetch(`/api/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
  if (!res.ok) throw new Error("Failed to persist message");
  return res.json();
}
