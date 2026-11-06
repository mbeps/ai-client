"use client";

import { useCallback, useMemo } from "react";
import type { KnowledgebaseWithCount } from "@/actions/knowledgebases/list-knowledgebases";
import { AssistantMessageBody } from "@/components/chat/message/assistant-message-body";
import { AttachmentGallery } from "@/components/chat/message/attachment-gallery";
import { CitationsList } from "@/components/chat/message/citations-list";
import {
  MessageActionSection,
  MessageHeader,
} from "@/components/chat/message/message-bubble-header";
import { deriveMessageBubbleViewData } from "@/components/chat/message/message-bubble-view-data";
import { MessageTimelineSection } from "@/components/chat/message/message-timeline-section";
import { useMessageEditing } from "@/components/chat/message/use-message-editing";
import { UserMessageBody } from "@/components/chat/message/user-message-body";
import { SITE_CONFIG } from "@/config/site";
import { authClient } from "@/lib/auth/auth-client";
import { extractMessageArtifacts } from "@/lib/chat/extract-message-artifacts";
import { extractMessageDownloads } from "@/lib/chat/extract-message-downloads";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { useAppStore } from "@/lib/store/use-app-store";
import { cn } from "@/lib/utils";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Assistant } from "@/types/assistant/assistant";
import type { Attachment } from "@/types/attachment/attachment";
import type { Citation } from "@/types/chat/citation";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { PublicMcpServer } from "@/types/mcp/public-mcp-server";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Renders the user attachment section component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
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
  /** Parent message in the thread tree, if any. */
  parentMessage?: Message | null;
  /** Whether this message is the last one in the current thread. */
  isLatest: boolean;
  /** Assistant ID bound to the chat. */
  assistantId?: string | null;
  /** Optional assistants list to resolve assistant names. */
  assistants?: Assistant[];
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
  /** Available MCP servers for tool selection in edit mode. */
  servers?: (McpServer | PublicMcpServer)[];
  /** Active thread messages for live context token calculation in edit mode. */
  thread?: Message[];
}

/**
 * Renders the message bubble component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function MessageBubble(props: MessageBubbleProps) {
  const {
    message,
    parentMessage,
    assistantId,
    assistants: assistantsProp,
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
    servers,
    thread,
  } = props;
  const { data: session } = authClient.useSession();
  const isUser = message.role === "user";
  const prompts = useAppStore((state) => state.prompts);
  const skills = useAppStore((state) => state.skills);
  const storeAssistants = useAppStore((state) => state.assistants);
  const assistantsList = assistantsProp ?? storeAssistants;

  const viewData = useMemo(
    () => deriveMessageBubbleViewData(message, isUser, streamingCitations),
    [message, isUser, streamingCitations],
  );

  const resolvedAssistantName = useMemo(() => {
    if (isUser) return undefined;

    const parentMeta = parentMessage
      ? parseMessageMetadata(parentMessage.metadata)
      : null;
    const effectiveAssistantId =
      parentMeta?.assistantId ??
      viewData.parsedMetadata.assistantId ??
      assistantId;

    if (effectiveAssistantId && Array.isArray(assistantsList)) {
      const matched = assistantsList.find((a) => a.id === effectiveAssistantId);
      if (matched?.name) {
        return matched.name;
      }
    }

    return SITE_CONFIG.DEFAULT_ASSISTANT_NAME;
  }, [
    isUser,
    parentMessage,
    viewData.parsedMetadata.assistantId,
    assistantId,
    assistantsList,
  ]);

  const messageArtifacts = useMemo(
    () => extractMessageArtifacts(message, activeToolCalls),
    [message, activeToolCalls],
  );

  const messageDownloads = useMemo(
    () => extractMessageDownloads(message, activeToolCalls),
    [message, activeToolCalls],
  );

  const { isEditing, handleStartEdit, handleCancel } = useMessageEditing();

  const handleSaveMessage = useCallback(
    (
      content: string,
      attachments: Attachment[],
      model: string,
      serverIds: string[],
      toolIds: string[],
      promptId?: string | string[],
      selectedAssistantId?: string,
      kbs?: string[],
      selectedSkillIds?: string[],
      subagentsEnabled?: boolean,
      subagentModelId?: string,
    ) => {
      onEdit(
        message.id,
        content,
        attachments,
        model,
        serverIds,
        toolIds,
        promptId,
        selectedAssistantId,
        kbs,
        selectedSkillIds,
        subagentsEnabled,
        subagentModelId,
      );
      handleCancel();
    },
    [message.id, onEdit, handleCancel],
  );

  return (
    <div
      className={cn(
        "group flex w-full flex-col gap-2 p-4",
        isUser ? "" : "bg-muted/30 rounded-lg",
        isEditing && "relative z-30",
      )}
    >
      <MessageHeader
        isUser={isUser}
        image={session?.user?.image}
        name={session?.user?.name}
        assistantName={resolvedAssistantName}
      />

      <div className={cn("min-w-0 flex-1", !isEditing && "overflow-hidden")}>
        <div className="text-sm">
          <MessageTimelineSection
            isUser={isUser}
            reasoning={reasoning}
            isStreamingReasoning={isStreamingReasoning}
            toolData={viewData.toolData}
            activeToolCalls={activeToolCalls}
            messageId={message.id}
            chatId={chatId}
          />

          {!isEditing && (
            <UserAttachmentSection
              isUser={isUser}
              attachments={message.attachments}
            />
          )}

          {isUser ? (
            <UserMessageBody
              promptIds={viewData.promptIds}
              prompts={prompts}
              selectedSkillIds={viewData.selectedSkillIds}
              skills={skills}
              selectedKbIds={viewData.selectedKbIds}
              knowledgebases={knowledgebases}
              isEditing={isEditing}
              displayContent={viewData.displayContent}
              editProps={
                isEditing
                  ? {
                      initialValue: viewData.displayContent,
                      initialModelId: viewData.parsedMetadata.modelId,
                      initialAttachments: message.attachments ?? [],
                      initialSelectedServerIds:
                        viewData.parsedMetadata.selectedServerIds,
                      initialSelectedTools:
                        viewData.parsedMetadata.selectedTools,
                      initialSelectedPromptId:
                        viewData.promptIds.length > 0
                          ? viewData.promptIds
                          : viewData.parsedMetadata.promptMeta?.promptId,
                      initialSelectedAssistantId:
                        viewData.parsedMetadata.assistantId ??
                        assistantId ??
                        undefined,
                      initialSelectedKbs: viewData.parsedMetadata.selectedKbIds,
                      initialSelectedSkillIds:
                        viewData.parsedMetadata.selectedSkillIds,
                      initialSubagentsEnabled:
                        viewData.parsedMetadata.subagentsEnabled,
                      initialSubagentModelId:
                        viewData.parsedMetadata.subagentModelId,
                      servers,
                      thread,
                      activeChatAssistantId: assistantId,
                      onCancel: handleCancel,
                      onSend: handleSaveMessage,
                    }
                  : undefined
              }
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
