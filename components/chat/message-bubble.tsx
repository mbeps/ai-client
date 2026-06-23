"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import type { Message } from "@/types/message/message";
import type { Attachment } from "@/types/attachment/attachment";
import type { ToolCallState } from "@/types/tool/tool-call";
import { ROUTES } from "@/constants/routes";
import { Bot, Command, Database, User } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkdownRenderer } from "./markdown-renderer";
import { ResponseTimeline } from "./message/response-timeline";
import { MessageActions } from "./message/message-actions";
import {
  parseMessageMetadata,
  extractCitations,
  type Citation,
} from "@/lib/store/mappers/message-mapper";
import { AttachmentGallery } from "./message/attachment-gallery";
import { CitationsList } from "./message/citations-list";
import { ChatInput } from "./chat-input";

/**
 * Props for the MessageBubble component.
 * Defines message data, callbacks, and rendering context for conversation threads.
 */
interface MessageBubbleProps {
  /** The message node from the conversation tree to render. */
  message: Message;
  /** Whether this message is the last one in the current thread. */
  isLatest: boolean;
  /** Whether this message is the first one in the thread. */
  isFirst?: boolean;
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
    promptId?: string,
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
  /** Callback to show the artifact associated with this message. */
  onShowArtifact?: () => void;
  /** Optional citations to show during streaming before they are persisted in metadata. */
  streamingCitations?: Citation[];
  /** Tool invocations currently in flight during streaming. */
  activeToolCalls?: ToolCallState[];
}

/**
 * Renders a single message within the conversation thread.
 * User messages display as plain pre-wrapped text; assistant messages render via
 * MarkdownRenderer with support for tool calls, reasoning tokens, and artifacts.
 * Shows left/right navigation arrows on hover when siblings exist for branching.
 * Supports inline editing (creates new sibling), deletion, and regeneration.
 * Fetches and caches presigned URLs for attachments on mount.
 *
 * @param props - Message data, callbacks, and siblings for branch navigation.
 * @returns Avatar, message content, optional thinking display, attachments, and actions.
 * @see MarkdownRenderer for assistant message content rendering.
 * @see ToolCallDisplay for visualizing tool invocations.
 * @see ThinkingDisplay for streaming reasoning output.
 * @see MessageActions for edit/delete/regenerate UI.
 * @author Maruf Bepary
 */
export function MessageBubble({
  message,
  isLatest,
  isFirst,
  assistantId,
  onDelete,
  onEdit,
  siblings,
  currentSiblingIndex,
  onNavigateBranch,
  reasoning,
  isStreamingReasoning,
  onRegenerate,
  onShowArtifact,
  streamingCitations,
  activeToolCalls,
}: MessageBubbleProps) {
  const { data: session } = authClient.useSession();
  const isUser = message.role === "user";
  const prompts = useAppStore((state) => state.prompts);
  const {
    promptMeta: rawPromptMeta,
    toolData: rawToolData,
    modelId: parsedModelId,
    selectedServerIds: parsedServerIds,
    selectedTools: parsedToolIds,
    selectedKbIds: parsedKbIds,
  } = useMemo(() => parseMessageMetadata(message.metadata), [message.metadata]);

  const citations = useMemo(() => {
    if (streamingCitations && streamingCitations.length > 0)
      return streamingCitations;
    if (!rawToolData) return [];
    return extractCitations(rawToolData.toolResults);
  }, [rawToolData, streamingCitations]);
  const mcpServers = useAppStore((state) => state.mcpServers);
  const { knowledgebases } = useKnowledgebases();
  const promptMeta = isUser ? rawPromptMeta : null;
  const selectedKbIds = isUser && parsedKbIds ? parsedKbIds : [];
  const toolData = isUser ? null : rawToolData;
  const promptEntry = promptMeta
    ? prompts.find((p) => p.id === promptMeta.promptId)
    : null;

  const modelName = useMemo(() => {
    if (isUser || !parsedModelId) return null;
    return parsedModelId;
  }, [isUser, parsedModelId]);

  const hasArtifact = useMemo(() => {
    if (!toolData) return false;
    return toolData.toolResults.some(
      (tr) => tr.toolName === "manage_artifact" && (tr.result as any)?.artifact,
    );
  }, [toolData]);

  const [isEditing, setIsEditing] = useState(false);

  return (
    <div
      className={`flex flex-col gap-2 p-4 w-full group ${isUser ? "" : "bg-muted/30 rounded-lg"}`}
    >
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6">
          {isUser ? (
            <>
              <AvatarImage
                src={session?.user?.image || undefined}
                alt={session?.user?.name || ""}
              />
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </>
          ) : (
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <Bot className="h-3 w-3" />
            </AvatarFallback>
          )}
        </Avatar>
        <div className="font-semibold text-sm">
          {isUser ? "You" : "Assistant"}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="text-sm">
          {!isUser && (
            <ResponseTimeline
              reasoning={reasoning}
              isStreamingReasoning={isStreamingReasoning}
              toolCalls={toolData?.toolCalls}
              toolResults={toolData?.toolResults}
              activeToolCalls={activeToolCalls}
              isLatest={isLatest}
            />
          )}

          {isUser && message.attachments && message.attachments.length > 0 && (
            <AttachmentGallery attachments={message.attachments} />
          )}
          {isUser ? (
            <div>
              {(promptMeta || selectedKbIds.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {promptMeta && (
                    <Link
                      href={ROUTES.SETTINGS.PROMPTS.detail(promptMeta.promptId)}
                      className="inline-flex items-center gap-1 text-xs rounded-md bg-primary/10 text-primary px-2 py-0.5 hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      <Command className="h-3 w-3" />/
                      {promptEntry?.shortcut ?? promptMeta.promptId}
                    </Link>
                  )}
                  {selectedKbIds.map((kbId) => {
                    const kb = knowledgebases.find((k) => k.id === kbId);
                    return (
                      <Link
                        key={kbId}
                        href={ROUTES.KNOWLEDGEBASES.detail(kbId)}
                        className="inline-flex items-center gap-1 text-xs rounded-md bg-primary/10 text-primary px-2 py-0.5 hover:bg-primary/20 transition-colors cursor-pointer"
                      >
                        <Database className="h-3 w-3" />
                        {kb?.name ?? kbId}
                      </Link>
                    );
                  })}
                </div>
              )}
              {isEditing ? (
                <ChatInput
                  initialValue={
                    promptMeta ? promptMeta.userContent : message.content
                  }
                  initialModelId={parsedModelId || undefined}
                  initialAttachments={message.attachments || []}
                  initialSelectedServerIds={parsedServerIds || []}
                  initialSelectedTools={parsedToolIds || []}
                  initialSelectedPromptId={promptMeta?.promptId}
                  submitLabel="Save"
                  onSend={(
                    content,
                    attachments,
                    model,
                    serverIds,
                    toolIds,
                    _resources,
                    promptId,
                  ) => {
                    onEdit(
                      message.id,
                      content,
                      attachments,
                      model,
                      serverIds,
                      toolIds,
                      promptId,
                    );
                    setIsEditing(false);
                  }}
                  onCancel={() => setIsEditing(false)}
                  servers={mcpServers.filter((s) => s.enabled)}
                  canMentionAssistant={isFirst && !assistantId}
                />
              ) : (
                <MarkdownRenderer
                  content={
                    promptMeta ? promptMeta.userContent : message.content
                  }
                />
              )}
            </div>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
          <CitationsList citations={citations} />
        </div>

        {!isEditing && (
          <MessageActions
            message={message}
            isUser={isUser}
            contentToCopy={message.content}
            onEdit={() => setIsEditing(true)}
            onDelete={onDelete}
            siblings={siblings}
            currentSiblingIndex={currentSiblingIndex}
            onNavigateBranch={onNavigateBranch}
            onRegenerate={onRegenerate}
            editContent={promptMeta ? promptMeta.userContent : undefined}
            modelName={modelName}
            onShowArtifact={onShowArtifact}
            hasArtifact={hasArtifact}
          />
        )}
      </div>
    </div>
  );
}
