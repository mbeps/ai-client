import type { ChatRow } from "./chat-row";
import type { MessageRow } from "@/types/message/message-row";
import type { AttachmentRow } from "@/types/attachment/attachment-row";

export interface ChatWithMessages extends ChatRow {
  messages: MessageRow[];
  attachments: AttachmentRow[];
  projectName?: string;
  assistantName?: string;
}
