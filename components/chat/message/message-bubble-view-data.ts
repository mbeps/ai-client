import { extractCitations } from "@/lib/chat/extract-citations";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import type { Citation } from "@/types/chat/citation";
import type { Message } from "@/types/message/message";
import type { ParsedMessageMetadata } from "@/types/message/metadata";

/**
 * Represents message edit args.
 *
 * @author Maruf Bepary
 */
export interface MessageEditArgs {
  message: Message;
  editContent: string;
  metadata: ParsedMessageMetadata;
  promptIds: string[];
  assistantId?: string | null;
}

/**
 * Performs fallback list.
 *
 * @param list - Target list
 * @returns The resolved result
 * @author Maruf Bepary
 */
function fallbackList(list: string[] | null | undefined): string[] {
  return list ?? [];
}

/**
 * Resolves prompt id for edit.
 *
 * @param promptIds - Target prompt ids
 * @param promptMeta - Target prompt meta
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolvePromptIdForEdit(
  promptIds: string[],
  promptMeta: ParsedMessageMetadata["promptMeta"],
): string | string[] | undefined {
  if (promptIds.length > 0) return promptIds;
  return promptMeta?.promptId;
}

/**
 * Resolves message edit params.
 *
 * @param props - Target props
 * @returns The resolved result
 * @author Maruf Bepary
 */
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

/**
 * Performs derive user view data.
 *
 * @param message - Target message
 * @param parsedMetadata - Target parsed metadata
 * @returns The resolved result
 * @author Maruf Bepary
 */
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

/**
 * Performs derive assistant view data.
 *
 * @param message - Target message
 * @param parsedMetadata - Target parsed metadata
 * @returns The resolved result
 * @author Maruf Bepary
 */
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

/**
 * Represents message bubble view data.
 *
 * @author Maruf Bepary
 */
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

/**
 * Resolves prompt ids.
 *
 * @param promptMeta - Target prompt meta
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolvePromptIds(
  promptMeta: ParsedMessageMetadata["promptMeta"],
): string[] {
  if (!promptMeta) return [];
  if (Array.isArray(promptMeta.promptIds) && promptMeta.promptIds.length > 0) {
    return promptMeta.promptIds;
  }
  return promptMeta.promptId ? [promptMeta.promptId] : [];
}

/**
 * Resolves citations.
 *
 * @param streamingCitations - Target streaming citations
 * @param rawToolData - Target raw tool data
 * @returns The resolved result
 * @author Maruf Bepary
 */
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

/**
 * Performs derive message bubble view data.
 *
 * @param message - Target message
 * @param isUser - Target is user
 * @param streamingCitations - Target streaming citations
 * @returns The resolved result
 * @author Maruf Bepary
 */
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
