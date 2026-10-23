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
import type { ParsedMessageMetadata } from "@/types/message/metadata";
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
      <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs">
        <Zap className="h-3 w-3 text-amber-500" />/{promptEntry?.title ?? pid}
      </span>
    );
  }
  return (
    <Link
      href={ROUTES.SETTINGS.PROMPTS.detail(pid)}
      className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors"
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
            className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
          >
            <BrainCircuit className="text-primary h-3 w-3" />/
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
            className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors"
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
  metadata: ParsedMessageMetadata;
  promptIds: string[];
  assistantId?: string | null;
}

function fallbackList(list: string[] | null | undefined): string[] {
  return list ?? [];
}

function resolvePromptIdForEdit(
  promptIds: string[],
  promptMeta: ParsedMessageMetadata["promptMeta"],
): string | string[] | undefined {
  if (promptIds.length > 0) return promptIds;
  return promptMeta?.promptId;
}

function resolveMessageEditParams({
  message,
  editContent,
  metadata,
  promptIds,
  assistantId,
}: MessageEditArgs) {
  const promptId = resolvePromptIdForEdit(promptIds, metadata.promptMeta);

  return [
    message.id,
    editContent,
    message.attachments ?? [],
    metadata.modelId ?? "",
    fallbackList(metadata.selectedServerIds),
    fallbackList(metadata.selectedTools),
    promptId,
    assistantId ?? undefined,
    fallbackList(metadata.selectedKbIds),
    fallbackList(metadata.selectedSkillIds),
    metadata.subagentsEnabled,
    metadata.subagentModelId,
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

function UserMessageEditor({
  editContent,
  onEditContentChange,
  onCancel,
  onSave,
  isSaveDisabled,
}: {
  editContent: string;
  onEditContentChange: (val: string) => void;
  onCancel: () => void;
  onSave: () => void;
  isSaveDisabled: boolean;
}) {
  return (
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
  );
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
        <UserMessageEditor
          editContent={editContent}
          onEditContentChange={onEditContentChange}
          onCancel={onCancel}
          onSave={onSave}
          isSaveDisabled={isSaveDisabled}
        />
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

function MessageHeader({
  isUser,
  image,
  name,
  modelName,
}: {
  isUser: boolean;
  image?: string | null;
  name?: string | null;
  modelName: string | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <MessageAvatar isUser={isUser} image={image} name={name} />
      <span className="text-sm font-semibold">
        {isUser ? "You" : (modelName ?? "Assistant")}
      </span>
    </div>
  );
}

function deriveUserViewData(
  message: Message,
  parsedMetadata: ParsedMessageMetadata,
) {
  const promptMeta = parsedMetadata.promptMeta;
  return {
    promptMeta,
    selectedKbIds: parsedMetadata.selectedKbIds ?? [],
    selectedSkillIds: parsedMetadata.selectedSkillIds ?? [],
    toolData: null,
    modelName: null,
    displayContent: promptMeta?.userContent ?? message.content,
  };
}

function deriveAssistantViewData(
  message: Message,
  parsedMetadata: ParsedMessageMetadata,
) {
  return {
    promptMeta: null,
    selectedKbIds: [],
    selectedSkillIds: [],
    toolData: parsedMetadata.toolData,
    modelName: parsedMetadata.modelId,
    displayContent: message.content,
  };
}

interface MessageBubbleViewData {
  parsedMetadata: ParsedMessageMetadata;
  promptMeta: ParsedMessageMetadata["promptMeta"];
  selectedKbIds: string[];
  selectedSkillIds: string[];
  toolData: ParsedMessageMetadata["toolData"];
  promptIds: string[];
  modelName: string | null;
  citations: Citation[];
  displayContent: string;
}

function resolvePromptIds(
  promptMeta: ParsedMessageMetadata["promptMeta"],
): string[] {
  if (!promptMeta) return [];
  if (Array.isArray(promptMeta.promptIds) && promptMeta.promptIds.length > 0) {
    return promptMeta.promptIds;
  }
  return promptMeta.promptId ? [promptMeta.promptId] : [];
}

function resolveCitations(
  streamingCitations: Citation[] | undefined,
  rawToolData: ParsedMessageMetadata["toolData"],
): Citation[] {
  if (streamingCitations && streamingCitations.length > 0) {
    return streamingCitations;
  }
  if (!rawToolData) return [];
  return extractCitations(rawToolData.toolResults);
}

function deriveMessageBubbleViewData(
  message: Message,
  isUser: boolean,
  streamingCitations?: Citation[],
): MessageBubbleViewData {
  const parsedMetadata = parseMessageMetadata(message.metadata);
  const baseData = isUser
    ? deriveUserViewData(message, parsedMetadata)
    : deriveAssistantViewData(message, parsedMetadata);
  const promptIds = resolvePromptIds(baseData.promptMeta);
  const citations = resolveCitations(streamingCitations, baseData.toolData);

  return {
    parsedMetadata,
    ...baseData,
    promptIds,
    citations,
  };
}

function MessageTimelineSection({
  isUser,
  reasoning,
  isStreamingReasoning,
  toolData,
  activeToolCalls,
  isLatest,
  messageId,
  chatId,
}: {
  isUser: boolean;
  reasoning?: string;
  isStreamingReasoning?: boolean;
  toolData: ParsedMessageMetadata["toolData"];
  activeToolCalls?: ToolCallState[];
  isLatest: boolean;
  messageId: string;
  chatId?: string;
}) {
  if (isUser) return null;
  return (
    <ResponseTimeline
      reasoning={reasoning}
      isStreamingReasoning={isStreamingReasoning}
      toolCalls={toolData?.toolCalls}
      toolResults={toolData?.toolResults}
      activeToolCalls={activeToolCalls}
      isLatest={isLatest}
      messageId={messageId}
      chatId={chatId}
    />
  );
}

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

function MessageActionSection({
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
}: {
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
}) {
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

interface UseMessageEditingProps {
  displayContent: string;
  hasAttachments: boolean;
  onSaveMessage: (content: string) => void;
}

function useMessageEditing({
  displayContent,
  hasAttachments,
  onSaveMessage,
}: UseMessageEditingProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(displayContent);

  const handleStartEdit = () => {
    setEditContent(displayContent);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!editContent.trim() && !hasAttachments) {
      return;
    }
    onSaveMessage(editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(displayContent);
    setIsEditing(false);
  };

  return {
    isEditing,
    editContent,
    setEditContent,
    handleStartEdit,
    handleSave,
    handleCancel,
  };
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
