import { extractCitations } from "@/lib/chat/extract-citations";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import type { Citation } from "@/types/chat/citation";
import type { Message } from "@/types/message/message";
import type { ParsedMessageMetadata } from "@/types/message/metadata";

export interface MessageEditArgs {
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

export function resolveMessageEditParams({
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

export interface MessageBubbleViewData {
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

export function deriveMessageBubbleViewData(
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
