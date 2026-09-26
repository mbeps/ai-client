"use client";

import { useCallback } from "react";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Attachment } from "@/types/attachment/attachment";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import { MessageBubble } from "./message-bubble";

/**
 * Props for the MessageThread component.
 */
interface MessageThreadProps {
  /** The linearised message thread (leaf-to-root) to render. */
  thread: Message[];
  /** The full chat record (for message lookups and assistant ID). */
  chat: Chat;
  /** Callback to edit a message (creates a new branch). */
  onEdit: (
    id: string,
    newContent: string,
    attachments: Attachment[],
    model: string,
    serverIds: string[],
    toolIds: string[],
    promptId?: string,
    assistantId?: string,
  ) => void;
  /** Callback to delete a message. */
  onDelete: (id: string) => void;
  /** Callback to regenerate an assistant response. */
  onRegenerate: (id: string) => void;
  /** Callback to navigate to a sibling branch by message ID. */
  onNavigateBranch: (messageId: string) => void;
  /** Callback to toggle a canvas artifact. */
  onToggleArtifact?: (artifact: ArtifactData) => void;
  /** Active artifact id if canvas is currently open. */
  activeArtifactId?: string | null;
  /** Whether canvas panel is currently open. */
  isCanvasOpen?: boolean;
}

/**
 * Renders the list of messages in the active conversation thread.
 * Handles empty state (no messages yet) and computes sibling navigation
 * context for each message to enable branch switching arrows.
 *
 * @param props - Thread data, callbacks, and chat context.
 * @returns A fragment of MessageBubble components or an empty-state prompt.
 */
export function MessageThread({
  thread,
  chat,
  onEdit,
  onDelete,
  onRegenerate,
  onNavigateBranch,
  onToggleArtifact,
  activeArtifactId,
  isCanvasOpen,
}: MessageThreadProps) {
  const { knowledgebases } = useKnowledgebases();
  const handleNavigateBranch = useCallback(
    (siblingId: string) => {
      onNavigateBranch(siblingId);
    },
    [onNavigateBranch],
  );

  if (thread.length === 0) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center text-center opacity-50">
        <h2 className="mb-2 font-bold text-2xl">How can I help you today?</h2>
        <p>Try asking for a diagram, math formula, or standard text.</p>
      </div>
    );
  }

  return (
    <>
      {thread.map((msg, index) => {
        const parent = msg.parentId ? chat.messages[msg.parentId] : null;
        const siblingsIds = parent
          ? parent.childrenIds
          : Object.values(chat.messages)
              .filter((m) => !m.parentId)
              .map((m) => m.id);
        const siblings = siblingsIds
          .map((id) => chat.messages[id])
          .filter(Boolean);
        const currentIndex = siblings.findIndex((s) => s.id === msg.id);

        return (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLatest={index === thread.length - 1}
            isFirst={index === 0}
            assistantId={chat?.assistantId}
            onDelete={onDelete}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            siblings={siblings}
            currentSiblingIndex={currentIndex}
            onNavigateBranch={handleNavigateBranch}
            reasoning={msg.reasoning}
            isStreamingReasoning={false}
            onToggleArtifact={onToggleArtifact}
            activeArtifactId={activeArtifactId}
            isCanvasOpen={isCanvasOpen}
            knowledgebases={knowledgebases}
          />
        );
      })}
    </>
  );
}
