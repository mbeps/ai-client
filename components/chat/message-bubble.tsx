"use client";

import { useMemo } from "react";
import type { KnowledgebaseWithCount } from "@/actions/knowledgebases/list-knowledgebases";
import { AssistantMessageBody } from "@/components/chat/message/assistant-message-body";
import { AttachmentGallery } from "@/components/chat/message/attachment-gallery";
import { CitationsList } from "@/components/chat/message/citations-list";
import {
  MessageActionSection,
  MessageHeader,
} from "@/components/chat/message/message-bubble-header";
import {
  deriveMessageBubbleViewData,
  resolveMessageEditParams,
} from "@/components/chat/message/message-bubble-view-data";
import { MessageTimelineSection } from "@/components/chat/message/message-timeline-section";
import { useMessageEditing } from "@/components/chat/message/use-message-editing";
import { UserMessageBody } from "@/components/chat/message/user-message-body";
import { authClient } from "@/lib/auth/auth-client";
import { extractMessageArtifacts } from "@/lib/chat/extract-message-artifacts";
import { extractMessageDownloads } from "@/lib/chat/extract-message-downloads";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Attachment } from "@/types/attachment/attachment";
import type { Citation } from "@/types/chat/citation";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

function UserAttachmentSection({
  isUser,
  attachments,
}: {
  isUser: boolean;
  attachments?: Attachment[];
}) {
  if (!isUser || !attachments || attachments.length === 0) return null;
  return <AttachmentGallery attachments={attachments} />;
}

/**
 * Props for the MessageBubble component.
 * Defines message data, callbacks, and rendering context for conversation threads.
 */
interface MessageBubbleProps {
  /** The message node from the conversation tree to render. */
  message: Message;
  /** Whether this message is the last one in the current thread. */
  isLatest: boolean;
  /** Assistant ID bound to the chat. */
  assistantId?: string | null;
  /** Callback to delete this message from the conversation tree. */
  onDelete: (id: string) => void;
  /** Callback to edit this message, which creates a new branch. */
  onEdit: (
    id: string,
    newContent: string,
    attachments: Attachment[],
    model: string,
    serverIds: string[],
    toolIds: string[],
    promptId?: string | string[],
    assistantId?: string,
    kbs?: string[],
    selectedSkillIds?: string[],
    subagentsEnabled?: boolean,
    subagentModelId?: string,
  ) => void;
  /** Callback to regenerate an assistant response. */
  onRegenerate?: (id: string) => void;
  // Branching props
  /** All sibling messages sharing the same parent; enables branch navigation. */
  siblings: Message[];
  /** Zero-based index of this message among its siblings. */
  currentSiblingIndex: number;
  /** Callback invoked with a sibling's ID when the user clicks a branch arrow. */
  onNavigateBranch: (siblingId: string) => void;
  /** The full reasoning/thinking text produced by the model. */
  reasoning?: string;
  /** True while the model is actively streaming its reasoning. */
  isStreamingReasoning?: boolean;
  /** Callback to toggle a canvas artifact. */
  onToggleArtifact?: (artifact: ArtifactData) => void;
  /** Active artifact id if canvas is currently open. */
  activeArtifactId?: string | null;
  /** Whether canvas panel is currently open. */
  isCanvasOpen?: boolean;
  /** Optional citations to show during streaming before they are persisted in metadata. */
  streamingCitations?: Citation[];
  /** Tool invocations currently in flight during streaming. */
  activeToolCalls?: ToolCallState[];
  /** Knowledge bases available for display in KB chips. */
  knowledgebases?: KnowledgebaseWithCount[];
  /** Optional chat ID for scratchpad authorization. */
  chatId?: string;
}

export function MessageBubble(props: MessageBubbleProps) {
  const {
    message,
    isLatest,
    assistantId,
    onDelete,
    onEdit,
    siblings,
    currentSiblingIndex,
    onNavigateBranch,
    reasoning,
    isStreamingReasoning,
    onRegenerate,
    onToggleArtifact,
    activeArtifactId,
    isCanvasOpen,
    streamingCitations,
    activeToolCalls,
    knowledgebases = [],
    chatId,
  } = props;
  const { data: session } = authClient.useSession();
  const isUser = message.role === "user";
  const prompts = useAppStore((state) => state.prompts);
  const skills = useAppStore((state) => state.skills);

  const viewData = useMemo(
    () => deriveMessageBubbleViewData(message, isUser, streamingCitations),
    [message, isUser, streamingCitations],
  );

  const messageArtifacts = useMemo(
    () => extractMessageArtifacts(message, activeToolCalls),
    [message, activeToolCalls],
  );

  const messageDownloads = useMemo(
    () => extractMessageDownloads(message, activeToolCalls),
    [message, activeToolCalls],
  );

  const hasAttachments = Boolean(
    message.attachments && message.attachments.length > 0,
  );

  const handleSaveMessage = (content: string) => {
    const editParams = resolveMessageEditParams({
      message,
      editContent: content,
      metadata: viewData.parsedMetadata,
      promptIds: viewData.promptIds,
      assistantId,
    });
    onEdit(...editParams);
  };

  const {
    isEditing,
    editContent,
    setEditContent,
    handleStartEdit,
    handleSave,
    handleCancel,
  } = useMessageEditing({
    displayContent: viewData.displayContent,
    hasAttachments,
    onSaveMessage: handleSaveMessage,
  });

  return (
    <div
      className={`group flex w-full flex-col gap-2 p-4 ${isUser ? "" : "bg-muted/30 rounded-lg"}`}
    >
      <MessageHeader
        isUser={isUser}
        image={session?.user?.image}
        name={session?.user?.name}
        modelName={viewData.modelName}
      />

      <div className="flex-1 overflow-hidden">
        <div className="text-sm">
          <MessageTimelineSection
            isUser={isUser}
            reasoning={reasoning}
            isStreamingReasoning={isStreamingReasoning}
            toolData={viewData.toolData}
            activeToolCalls={activeToolCalls}
            isLatest={isLatest}
            messageId={message.id}
            chatId={chatId}
          />

          <UserAttachmentSection
            isUser={isUser}
            attachments={message.attachments}
          />

          {isUser ? (
            <UserMessageBody
              promptIds={viewData.promptIds}
              prompts={prompts}
              selectedSkillIds={viewData.selectedSkillIds}
              skills={skills}
              selectedKbIds={viewData.selectedKbIds}
              knowledgebases={knowledgebases}
              isEditing={isEditing}
              editContent={editContent}
              onEditContentChange={setEditContent}
              onCancel={handleCancel}
              onSave={handleSave}
              hasAttachments={hasAttachments}
              displayContent={viewData.displayContent}
            />
          ) : (
            <AssistantMessageBody
              messageArtifacts={messageArtifacts}
              messageDownloads={messageDownloads}
              content={message.content}
              isCanvasOpen={isCanvasOpen}
              activeArtifactId={activeArtifactId}
              onToggleArtifact={onToggleArtifact}
              createdAt={message.createdAt}
            />
          )}
          <CitationsList citations={viewData.citations} />
        </div>

        <MessageActionSection
          isEditing={isEditing}
          message={message}
          isUser={isUser}
          onEdit={handleStartEdit}
          onDelete={onDelete}
          siblings={siblings}
          currentSiblingIndex={currentSiblingIndex}
          onNavigateBranch={onNavigateBranch}
          onRegenerate={onRegenerate}
          editContent={viewData.promptMeta?.userContent}
          metadata={viewData.parsedMetadata}
        />
      </div>
    </div>
  );
}
