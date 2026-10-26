import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";

/**
 * Extracts assistant id.
 *
 * @param metadata - Message metadata object or serialized string
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractAssistantId(
  metadata: string | null | undefined,
): string | undefined {
  if (!metadata) return undefined;
  try {
    const raw = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    return typeof raw?.assistantId === "string" ? raw.assistantId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extracts legacy prompt ids.
 *
 * @param metadata - Message metadata object or serialized string
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractLegacyPromptIds(
  metadata: string | null | undefined,
): string[] | undefined {
  if (!metadata) return undefined;
  try {
    const raw = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    if (Array.isArray(raw?.promptIds) && raw.promptIds.length > 0) {
      return raw.promptIds;
    }
    if (typeof raw?.promptId === "string") {
      return [raw.promptId];
    }
  } catch {}
  return undefined;
}

/**
 * Extracts prompt info.
 *
 * @param parentMsg - Target parent msg
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractPromptInfo(parentMsg: Message) {
  const meta = parseMessageMetadata(parentMsg.metadata);
  const promptMeta = meta.promptMeta;
  const promptIds =
    promptMeta?.promptIds ?? extractLegacyPromptIds(parentMsg.metadata);
  return {
    userContent: promptMeta?.userContent || parentMsg.content,
    promptIds,
    assistantId: extractAssistantId(parentMsg.metadata),
    meta,
  };
}

/**
 * Extracts regenerate payload.
 *
 * @param parentMsg - Target parent msg
 * @returns The resolved result
 * @author Maruf Bepary
 */
function extractRegeneratePayload(parentMsg: Message) {
  const { userContent, promptIds, assistantId, meta } =
    extractPromptInfo(parentMsg);

  return {
    userContent,
    model: meta.modelId || "",
    serverIds: meta.selectedServerIds || [],
    toolIds: meta.selectedTools || [],
    promptIds,
    assistantId,
    selectedKbIds: meta.selectedKbIds || [],
    selectedSkillIds: meta.selectedSkillIds || [],
    subagentsEnabled: meta.subagentsEnabled,
    subagentModelId: meta.subagentModelId,
  };
}

/**
 * Resolves regenerate payload.
 *
 * @param chat - Target chat
 * @param assistantMessageId - Target assistant message id
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function resolveRegeneratePayload(
  chat?: Chat,
  assistantMessageId?: string,
) {
  if (!chat || !assistantMessageId) return null;
  const msg = chat.messages[assistantMessageId];
  if (msg?.role !== "assistant" || !msg.parentId) return null;
  const parentMsg = chat.messages[msg.parentId];
  if (!parentMsg) return null;
  return {
    parentMsg,
    payload: extractRegeneratePayload(parentMsg),
  };
}
