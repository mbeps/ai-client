import { AttachmentBubble } from "@/components/chat/input/attachment-bubble";
import type { Attachment } from "@/types/attachment/attachment";

interface ChatInputAttachmentListProps {
  attachments: Attachment[];
  supportsVision: boolean;
  onRemove: (id: string) => void;
}

export function ChatInputAttachmentList({
  attachments,
  supportsVision,
  onRemove,
}: ChatInputAttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 pb-2">
      {attachments.map((att) => (
        <AttachmentBubble
          key={att.id}
          attachment={att}
          supportsVision={supportsVision}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
