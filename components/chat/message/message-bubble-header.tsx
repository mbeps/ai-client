"use client";

import { MessageActions } from "@/components/chat/message/message-actions";
import { MessageAvatar } from "@/components/chat/message/message-avatar";
import type { Message } from "@/types/message/message";
import type { ParsedMessageMetadata } from "@/types/message/metadata";

/**
 * Represents message header props.
 *
 * @author Maruf Bepary
 */
interface MessageHeaderProps {
  isUser: boolean;
  image?: string | null;
  name?: string | null;
  modelName: string | null;
}

/**
 * Renders the message header component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function MessageHeader({
  isUser,
  image,
  name,
  modelName,
}: MessageHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <MessageAvatar isUser={isUser} image={image} name={name} />
      <span className="text-sm font-semibold">
        {isUser ? "You" : (modelName ?? "Assistant")}
      </span>
    </div>
  );
}

/**
 * Represents message action section props.
 *
 * @author Maruf Bepary
 */
interface MessageActionSectionProps {
  isEditing: boolean;
  message: Message;
  isUser: boolean;
  onEdit: () => void;
  onDelete: (id: string) => void;
  siblings: Message[];
  currentSiblingIndex: number;
  onNavigateBranch: (siblingId: string) => void;
  onRegenerate?: (id: string) => void;
  editContent?: string;
  metadata: ParsedMessageMetadata;
}

/**
 * Renders the message action section component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function MessageActionSection({
  isEditing,
  message,
  isUser,
  onEdit,
  onDelete,
  siblings,
  currentSiblingIndex,
  onNavigateBranch,
  onRegenerate,
  editContent,
  metadata,
}: MessageActionSectionProps) {
  if (isEditing) return null;
  return (
    <MessageActions
      message={message}
      isUser={isUser}
      contentToCopy={message.content}
      onEdit={onEdit}
      onDelete={onDelete}
      siblings={siblings}
      currentSiblingIndex={currentSiblingIndex}
      onNavigateBranch={onNavigateBranch}
      onRegenerate={onRegenerate}
      editContent={editContent}
      metadata={metadata}
    />
  );
}
