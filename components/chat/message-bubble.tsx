"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import type { Message } from "@/types/message";
import { ROUTES } from "@/constants/routes";
import { MODELS } from "@/constants/models";
import { Bot, Command, User } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolCallDisplay } from "./message/tool-call-display";
import { ThinkingDisplay } from "./message/thinking-display";
import { MessageActions } from "./message/message-actions";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { AttachmentGallery } from "./message/attachment-gallery";
import { MessageEditForm } from "./message/message-edit-form";

/**
 * Props for the MessageBubble component.
 * Defines message data, callbacks, and rendering context for conversation threads.
 */
interface MessageBubbleProps {
  /** The message node from the conversation tree to render. */
  message: Message;
  /** Whether this message is the last one in the current thread. */
  isLatest: boolean;
  /** Callback to delete this message from the conversation tree. */
  onDelete: (id: string) => void;
  /** Callback to edit this message, which creates a new branch. */
  onEdit: (id: string, newContent: string) => void;
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
  onDelete,
  onEdit,
  siblings,
  currentSiblingIndex,
  onNavigateBranch,
  reasoning,
  isStreamingReasoning,
  onRegenerate,
  onShowArtifact,
}: MessageBubbleProps) {
  const { data: session } = authClient.useSession();
  const isUser = message.role === "user";
  const prompts = useAppStore((state) => state.prompts);
  const {
    promptMeta: rawPromptMeta,
    toolData: rawToolData,
    modelId: parsedModelId,
  } = useMemo(() => parseMessageMetadata(message.metadata), [message.metadata]);
  const promptMeta = isUser ? rawPromptMeta : null;
  const toolData = isUser ? null : rawToolData;
  const promptEntry = promptMeta
    ? prompts.find((p) => p.id === promptMeta.promptId)
    : null;

  const modelName = useMemo(() => {
    if (isUser || !parsedModelId) return null;
    return (
      MODELS.find((m) => m.value === parsedModelId)?.label || parsedModelId
    );
  }, [isUser, parsedModelId]);

  const hasArtifact = useMemo(() => {
    if (!toolData) return false;
    return toolData.toolResults.some(
      (tr) => tr.toolName === "manage_artifact" && (tr.result as any)?.artifact,
    );
  }, [toolData]);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(
    promptMeta ? promptMeta.userContent : message.content,
  );

  return (
    <div
      className={`flex gap-4 p-4 w-full group ${isUser ? "" : "bg-muted/30 rounded-lg"}`}
    >
      <div className="shrink-0 mt-1">
        <Avatar className="h-8 w-8">
          {isUser ? (
            <>
              <AvatarImage
                src={session?.user?.image || undefined}
                alt={session?.user?.name || ""}
              />
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </>
          ) : (
            <AvatarFallback className="bg-secondary text-secondary-foreground">
              <Bot className="h-4 w-4" />
            </AvatarFallback>
          )}
        </Avatar>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="font-semibold text-sm mb-1">
          {isUser ? "You" : "Assistant"}
        </div>

        <div className="text-sm">
          <ThinkingDisplay
            reasoning={reasoning ?? ""}
            isStreaming={!isUser && isStreamingReasoning}
            initialOpen={isLatest && !!reasoning}
          />

          {toolData && (
            <ToolCallDisplay
              toolCalls={toolData.toolCalls}
              toolResults={toolData.toolResults}
            />
          )}

          {isUser && message.attachments && message.attachments.length > 0 && (
            <AttachmentGallery attachments={message.attachments} />
          )}
          {isUser ? (
            <div>
              {promptMeta && (
                <Link
                  href={ROUTES.SETTINGS.PROMPTS.detail(promptMeta.promptId)}
                  className="inline-flex items-center gap-1 text-xs rounded-md bg-primary/10 text-primary px-2 py-0.5 mb-2 hover:bg-primary/20 transition-colors cursor-pointer"
                >
                  <Command className="h-3 w-3" />/
                  {promptEntry?.shortcut ?? promptMeta.promptId}
                </Link>
              )}
              {isEditing ? (
                <MessageEditForm
                  value={editValue}
                  onChange={setEditValue}
                  onSave={() => {
                    onEdit(message.id, editValue);
                    setIsEditing(false);
                  }}
                  onCancel={() => {
                    setIsEditing(false);
                    setEditValue(
                      promptMeta ? promptMeta.userContent : message.content,
                    );
                  }}
                />
              ) : (
                <div className="whitespace-pre-wrap">
                  {promptMeta ? promptMeta.userContent : message.content}
                </div>
              )}
            </div>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
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
