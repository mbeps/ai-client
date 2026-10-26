import { clearInflightState } from "@/hooks/chat/stream/use-stream-inflight-state";
import { ACCESS_OR_NOT_FOUND_PATTERNS } from "@/hooks/chat/stream/use-stream-types";
import { buildChatFromRows } from "@/lib/chat/message-tree-utils";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Chat } from "@/types/chat/chat";

/**
 * Checks whether an error is a 404 or authorization/access failure.
 *
 * @param err - Error instance or error payload to inspect
 * @returns True if error matches not found or access denied patterns
 * @author Maruf Bepary
 */
export function isAccessOrNotFoundError(err: unknown): boolean {
  if (!err) return false;
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
  return ACCESS_OR_NOT_FOUND_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
}

/**
 * Finds assistant message in fetched history matching assistant ID or target parent ID.
 *
 * @param messages - Array of message rows from database
 * @param assistantId - Specific assistant message ID to find, if known
 * @param targetParentId - Fallback user turn parent message ID to match against
 * @returns Matched message row or undefined
 * @author Maruf Bepary
 */
export function findMatchingAssistantMessage(
  messages: Array<{
    id: string;
    role: string;
    parentId?: string | null;
    content: string;
  }>,
  assistantId: string | null,
  targetParentId?: string | null,
) {
  return messages.find((m) => {
    if (m.role !== "assistant") return false;
    if (assistantId) return m.id === assistantId;
    if (targetParentId) return m.parentId === targetParentId;
    return true;
  });
}

/**
 * Verifies if the chat exists in local store.
 *
 * @param chatId - Chat identifier to check
 * @returns True if chat is present in Zustand store
 * @author Maruf Bepary
 */
export function isChatInStore(chatId: string): boolean {
  if (!chatId) return false;
  const chats = useAppStore.getState().chats;
  return Boolean(chats?.[chatId]);
}

/**
 * Ensures there is an assistant ID or parent ID to match against in DB sync.
 *
 * @param assistantId - Candidate assistant message ID
 * @param targetParentId - Candidate parent message ID
 * @returns True if at least one matching key exists
 * @author Maruf Bepary
 */
export function hasValidSyncTarget(
  assistantId: string | null,
  targetParentId?: string,
): boolean {
  if (assistantId) return true;
  return Boolean(targetParentId);
}

/**
 * Handles database sync errors, cleanly setting not-found state if chat was deleted.
 *
 * @param err - Sync error thrown
 * @param setChatNotFound - Setter to mark chat as deleted/not found
 * @param resetStreamingState - Callback to reset active streaming state
 * @author Maruf Bepary
 */
export function handleSyncError(
  err: unknown,
  setChatNotFound: (notFound: boolean) => void,
  resetStreamingState: () => void,
) {
  if (isAccessOrNotFoundError(err)) {
    setChatNotFound(true);
    resetStreamingState();
    return;
  }
  logger.error("Failed to sync chat from DB", err);
}

/**
 * Applies full chat from DB rows and notifies completion callback.
 *
 * @param chatId - ID of chat being updated
 * @param data - Database rows containing chat and message models
 * @param assistantMsg - Resolved assistant message object with text content
 * @param upsertChat - Store action to update or insert chat
 * @param onDone - Optional completion callback invoked with response content
 * @author Maruf Bepary
 */
export function applySyncedAssistantMessage(
  chatId: string,
  data: Parameters<typeof buildChatFromRows>[0],
  assistantMsg: { content: string },
  upsertChat: (chat: Chat) => void,
  onDone?: (content: string) => void,
) {
  clearInflightState(chatId);
  const fullChat = buildChatFromRows(data);
  upsertChat(fullChat);
  if (onDone) {
    onDone(assistantMsg.content);
  }
}

/**
 * Resolves the parent message ID to associate with the synced assistant message.
 *
 * @param userMsgId - Message ID of user turn
 * @param activeLeaf - Current active leaf node in thread
 * @returns Resolved parent message ID
 * @author Maruf Bepary
 */
export function resolveSyncTargetParentId(
  userMsgId: string | null,
  activeLeaf?: { id: string },
): string | undefined {
  if (userMsgId) return userMsgId;
  return activeLeaf ? activeLeaf.id : undefined;
}
