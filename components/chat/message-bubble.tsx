"use client";

import {
  Bot,
  BrainCircuit,
  Check,
  Command,
  Database,
  User,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { KnowledgebaseWithCount } from "@/actions/knowledgebases/list-knowledgebases";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { downloadArtifact } from "@/lib/artifacts/download-artifact";
import { authClient } from "@/lib/auth/auth-client";
import { extractCitations } from "@/lib/chat/extract-citations";
import { extractMessageArtifacts } from "@/lib/chat/extract-message-artifacts";
import { extractMessageDownloads } from "@/lib/chat/extract-message-downloads";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { useAppStore } from "@/lib/store";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Attachment } from "@/types/attachment/attachment";
import type { Citation } from "@/types/chat/citation";
import type { DownloadItem } from "@/types/download/download-item";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";
import { MarkdownRenderer } from "./markdown-renderer";
import { AttachmentGallery } from "./message/attachment-gallery";
import { CanvasCard } from "./message/canvas-card";
import { CitationsList } from "./message/citations-list";
import { DownloadCard } from "./message/download-card";
import { MessageActions } from "./message/message-actions";
import { ResponseTimeline } from "./message/response-timeline";

interface UserMessageContextChipsProps {
  promptIds: string[];
  prompts: Array<{ id: string; title?: string; shortcut?: string }>;
  selectedSkillIds: string[];
  skills: Array<{ id: string; name: string; displayName?: string }>;
  selectedKbIds: string[];
  knowledgebases: KnowledgebaseWithCount[];
}

function PromptChip({
  pid,
  promptEntry,
}: {
  pid: string;
  promptEntry?: { title?: string; shortcut?: string };
}) {
  const isMcp = pid.startsWith("mcp:");
  if (isMcp) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-primary text-xs">
        <Zap className="h-3 w-3 text-amber-500" />/{promptEntry?.title ?? pid}
      </span>
    );
  }
  return (
    <Link
      href={ROUTES.SETTINGS.PROMPTS.detail(pid)}
      className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-primary text-xs transition-colors hover:bg-primary/20"
    >
      <Command className="h-3 w-3" />/
      {promptEntry?.shortcut ?? promptEntry?.title ?? pid}
    </Link>
  );
}

function UserMessageContextChips({
  promptIds,
  prompts,
  selectedSkillIds,
  skills,
  selectedKbIds,
  knowledgebases,
}: UserMessageContextChipsProps) {
  if (
    promptIds.length === 0 &&
    selectedSkillIds.length === 0 &&
    selectedKbIds.length === 0
  ) {
    return null;
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {promptIds.map((pid) => (
        <PromptChip
          key={pid}
          pid={pid}
          promptEntry={prompts.find((p) => p.id === pid)}
        />
      ))}
      {selectedSkillIds.map((skillId) => {
        const skill = skills.find(
          (s) => s.id === skillId || s.name === skillId,
        );
        return (
          <span
            key={skillId}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-primary text-xs"
          >
            <BrainCircuit className="h-3 w-3 text-primary" />/
            {skill?.displayName ?? skill?.name ?? skillId}
          </span>
        );
      })}
      {selectedKbIds.map((kbId) => {
        const kb = knowledgebases.find((k) => k.id === kbId);
        return (
          <Link
            key={kbId}
            href={ROUTES.KNOWLEDGEBASES.detail(kbId)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-primary text-xs transition-colors hover:bg-primary/20"
          >
            <Database className="h-3 w-3" />
            {kb?.name ?? kbId}
          </Link>
        );
      })}
    </div>
  );
}

function MessageAvatar({
  isUser,
  image,
  name,
}: {
  isUser: boolean;
  image?: string | null;
  name?: string | null;
}) {
  return (
    <Avatar className="h-6 w-6">
      {isUser ? (
        <>
          <AvatarImage src={image ?? undefined} alt={name ?? ""} />
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
  );
}

interface MessageEditArgs {
  message: Message;
  editContent: string;
  metadata: ReturnType<typeof parseMessageMetadata>;
  promptIds: string[];
  assistantId?: string | null;
}

function resolveMessageEditParams({
  message,
  editContent,
  metadata,
  promptIds,
  assistantId,
}: MessageEditArgs) {
  const attachments = message.attachments ?? [];
  const modelId = metadata.modelId ?? "";
  const serverIds = metadata.selectedServerIds ?? [];
  const toolIds = metadata.selectedTools ?? [];
  const promptId =
    promptIds.length > 0 ? promptIds : metadata.promptMeta?.promptId;
  const resolvedAssistantId = assistantId ?? undefined;

  return [
    message.id,
    editContent,
    attachments,
    modelId,
    serverIds,
    toolIds,
    promptId,
    resolvedAssistantId,
    metadata.selectedKbIds ?? [],
    metadata.selectedSkillIds ?? [],
    metadata.subagentsEnabled,
    metadata.subagentModelId,
    metadata.subagentExcludedTools,
  ] as const;
}

interface UserMessageBodyProps {
  promptIds: string[];
  prompts: Array<{ id: string; title?: string; shortcut?: string }>;
  selectedSkillIds: string[];
  skills: Array<{ id: string; name: string; displayName?: string }>;
  selectedKbIds: string[];
  knowledgebases: KnowledgebaseWithCount[];
  isEditing: boolean;
  editContent: string;
  onEditContentChange: (val: string) => void;
  onCancel: () => void;
  onSave: () => void;
  hasAttachments: boolean;
  displayContent: string;
}

function UserMessageBody({
  promptIds,
  prompts,
  selectedSkillIds,
  skills,
  selectedKbIds,
  knowledgebases,
  isEditing,
  editContent,
  onEditContentChange,
  onCancel,
  onSave,
  hasAttachments,
  displayContent,
}: UserMessageBodyProps) {
  const isSaveDisabled = !editContent.trim() && !hasAttachments;

  return (
    <div>
      <UserMessageContextChips
        promptIds={promptIds}
        prompts={prompts}
        selectedSkillIds={selectedSkillIds}
        skills={skills}
        selectedKbIds={selectedKbIds}
        knowledgebases={knowledgebases}
      />
      {isEditing ? (
        <div className="my-2 w-full space-y-3">
          <MarkdownTabEditor
            value={editContent}
            onChange={onEditContentChange}
            placeholder="Edit your message..."
            minHeight="min-h-[140px]"
            maxHeight="max-h-[500px]"
            defaultTab="rich"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="cursor-pointer"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onSave}
              disabled={isSaveDisabled}
              className="cursor-pointer"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Save & Submit
            </Button>
          </div>
        </div>
      ) : (
        <MarkdownRenderer content={displayContent} />
      )}
    </div>
  );
}

interface AssistantMessageBodyProps {
  messageArtifacts: ArtifactData[];
  messageDownloads: DownloadItem[];
  content: string;
  isCanvasOpen?: boolean;
  activeArtifactId?: string | null;
  onToggleArtifact?: (artifact: ArtifactData) => void;
  createdAt?: string | Date;
}

function AssistantMessageBody({
  messageArtifacts,
  messageDownloads,
  content,
  isCanvasOpen,
  activeArtifactId,
  onToggleArtifact,
  createdAt,
}: AssistantMessageBodyProps) {
  return (
    <>
      {messageArtifacts.map((art) => (
        <CanvasCard
          key={art.id}
          artifact={art}
          isOpen={Boolean(isCanvasOpen && activeArtifactId === art.id)}
          onToggle={() => onToggleArtifact?.(art)}
          onDownload={() => downloadArtifact(art)}
          createdAt={createdAt}
        />
      ))}
      {messageDownloads.map((dl) => (
        <DownloadCard key={dl.id} item={dl} createdAt={createdAt} />
      ))}
      <MarkdownRenderer content={content} />
    </>
  );
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
    promptId?: string | string[],
    assistantId?: string,
    kbs?: string[],
    selectedSkillIds?: string[],
    subagentsEnabled?: boolean,
    subagentModelId?: string,
    subagentExcludedTools?: string[],
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

export function MessageBubble({
  message,
  isLatest,
  isFirst: _isFirst,
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
}: MessageBubbleProps) {
  const { data: session } = authClient.useSession();
  const isUser = message.role === "user";
  const prompts = useAppStore((state) => state.prompts);
  const parsedMetadata = useMemo(
    () => parseMessageMetadata(message.metadata),
    [message.metadata],
  );
  const {
    promptMeta: rawPromptMeta,
    toolData: rawToolData,
    modelId: parsedModelId,
    selectedKbIds: parsedKbIds,
    selectedSkillIds: parsedSkillIds,
  } = parsedMetadata;

  const citations = useMemo(() => {
    if (streamingCitations && streamingCitations.length > 0)
      return streamingCitations;
    if (!rawToolData) return [];
    return extractCitations(rawToolData.toolResults);
  }, [rawToolData, streamingCitations]);
  const promptMeta = isUser ? rawPromptMeta : null;
  const selectedKbIds = isUser && parsedKbIds ? parsedKbIds : [];
  const selectedSkillIds = isUser && parsedSkillIds ? parsedSkillIds : [];
  const skills = useAppStore((state) => state.skills);
  const toolData = isUser ? null : rawToolData;
  const promptIds = useMemo(() => {
    if (!promptMeta) return [];
    if (
      Array.isArray(promptMeta.promptIds) &&
      promptMeta.promptIds.length > 0
    ) {
      return promptMeta.promptIds;
    }
    return promptMeta.promptId ? [promptMeta.promptId] : [];
  }, [promptMeta]);

  const modelName = useMemo(() => {
    if (isUser || !parsedModelId) return null;
    return parsedModelId;
  }, [isUser, parsedModelId]);

  const messageArtifacts = useMemo(
    () => extractMessageArtifacts(message, activeToolCalls),
    [message, activeToolCalls],
  );

  const messageDownloads = useMemo(
    () => extractMessageDownloads(message, activeToolCalls),
    [message, activeToolCalls],
  );

  const initialContent = promptMeta ? promptMeta.userContent : message.content;
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(initialContent);

  const handleStartEdit = () => {
    setEditContent(promptMeta ? promptMeta.userContent : message.content);
    setIsEditing(true);
  };

  const handleSave = () => {
    const hasAttachments = Boolean(
      message.attachments && message.attachments.length > 0,
    );
    if (!editContent.trim() && !hasAttachments) {
      return;
    }

    const editParams = resolveMessageEditParams({
      message,
      editContent,
      metadata: parsedMetadata,
      promptIds,
      assistantId,
    });
    onEdit(...editParams);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(promptMeta ? promptMeta.userContent : message.content);
    setIsEditing(false);
  };

  return (
    <div
      className={`group flex w-full flex-col gap-2 p-4 ${isUser ? "" : "rounded-lg bg-muted/30"}`}
    >
      <div className="flex items-center gap-2">
        <MessageAvatar
          isUser={isUser}
          image={session?.user?.image}
          name={session?.user?.name}
        />
        <span className="font-semibold text-sm">
          {isUser ? "You" : (modelName ?? "Assistant")}
        </span>
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
              messageId={message.id}
              chatId={chatId}
            />
          )}

          {isUser && message.attachments && message.attachments.length > 0 && (
            <AttachmentGallery attachments={message.attachments} />
          )}

          {isUser ? (
            <UserMessageBody
              promptIds={promptIds}
              prompts={prompts}
              selectedSkillIds={selectedSkillIds}
              skills={skills}
              selectedKbIds={selectedKbIds}
              knowledgebases={knowledgebases}
              isEditing={isEditing}
              editContent={editContent}
              onEditContentChange={setEditContent}
              onCancel={handleCancel}
              onSave={handleSave}
              hasAttachments={Boolean(
                message.attachments && message.attachments.length > 0,
              )}
              displayContent={
                promptMeta ? promptMeta.userContent : message.content
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
            metadata={parsedMetadata}
          />
        )}
      </div>
    </div>
  );
}
