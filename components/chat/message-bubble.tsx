"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { authClient } from "@/lib/auth/auth-client";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import type { KnowledgebaseWithCount } from "@/lib/actions/knowledgebases/list-knowledgebases";
import type { Message } from "@/types/message/message";
import type { Attachment } from "@/types/attachment/attachment";
import type { ToolCallState } from "@/types/tool/tool-call";
import { ROUTES } from "@/constants/routes";
import { Bot, Command, Database, User } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkdownRenderer } from "./markdown-renderer";
import { ResponseTimeline } from "./message/response-timeline";
import { MessageActions } from "./message/message-actions";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { extractCitations } from "@/lib/chat/extract-citations";
import { extractArtifactFromToolResult } from "@/lib/chat/extract-artifact-from-tool-result";
import type { Citation } from "@/types/chat/citation";
import { AttachmentGallery } from "./message/attachment-gallery";
import { CitationsList } from "./message/citations-list";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { Button } from "@/components/ui/button";

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
    assistantId?: string,
    kbs?: string[],
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
  /** Knowledge bases available for display in KB chips. */
  knowledgebases?: KnowledgebaseWithCount[];
}

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
  knowledgebases = [],
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
    const hasMermaid = /```mermaid/i.test(message.content);
    if (hasMermaid) return true;
    if (!toolData) return false;
    return toolData.toolResults.some(
      (tr) => !!extractArtifactFromToolResult(tr),
    );
  }, [message.content, toolData]);

  const initialContent = promptMeta ? promptMeta.userContent : message.content;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(initialContent);

  const handleStartEdit = () => {
    setEditContent(promptMeta ? promptMeta.userContent : message.content);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (
      !editContent.trim() &&
      (!message.attachments || message.attachments.length === 0)
    ) {
      return;
    }
    onEdit(
      message.id,
      editContent,
      message.attachments || [],
      parsedModelId || "",
      parsedServerIds || [],
      parsedToolIds || [],
      promptMeta?.promptId,
      assistantId || undefined,
      selectedKbIds,
    );
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(promptMeta ? promptMeta.userContent : message.content);
    setIsEditing(false);
  };

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
        <span className="font-semibold text-sm">
          {isUser ? "You" : modelName ? modelName : "Assistant"}
        </span>
        {promptEntry && (
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
            <Command className="h-3 w-3" />
            {promptEntry.title}
          </span>
        )}
        {selectedKbIds.length > 0 && (
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
            <Database className="h-3 w-3" />
            {selectedKbIds
              .map((id) => knowledgebases.find((kb) => kb.id === id)?.name)
              .filter(Boolean)
              .join(", ") || `${selectedKbIds.length} knowledgebases`}
          </span>
        )}
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
                <div className="space-y-3 w-full my-2">
                  <MarkdownTabEditor
                    value={editContent}
                    onChange={setEditContent}
                    placeholder="Edit your message..."
                    minHeight="min-h-[140px]"
                    maxHeight="max-h-[500px]"
                    defaultTab="rich"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancel}
                      className="cursor-pointer"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={
                        !editContent.trim() &&
                        (!message.attachments ||
                          message.attachments.length === 0)
                      }
                      className="cursor-pointer"
                    >
                      Save & Submit
                    </Button>
                  </div>
                </div>
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
            onEdit={handleStartEdit}
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
