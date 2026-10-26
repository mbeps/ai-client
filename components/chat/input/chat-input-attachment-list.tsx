import { AttachmentBubble } from "@/components/chat/input/attachment-bubble";
import type { Attachment } from "@/types/attachment/attachment";

/**
 * Represents chat input attachment list props.
 *
 * @author Maruf Bepary
 */
interface ChatInputAttachmentListProps {
  attachments: Attachment[];
  supportsVision: boolean;
  onRemove: (id: string) => void;
}

/**
 * Renders the chat input attachment list component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
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
