import { ChatRow } from "./chat-row";
import { MessageRow } from "./message-row";
import { AttachmentRow } from "./attachment-row";

export interface ChatWithMessages extends ChatRow {
  messages: MessageRow[];
  attachments: AttachmentRow[];
  projectName?: string;
  assistantName?: string;
}
