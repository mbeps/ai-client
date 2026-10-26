import { clearInflightState } from "@/hooks/chat/stream/use-stream-inflight-state";
import { ACCESS_OR_NOT_FOUND_PATTERNS } from "@/hooks/chat/stream/use-stream-types";
import { buildChatFromRows } from "@/lib/chat/message-tree-utils";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Chat } from "@/types/chat/chat";

/**
 * Checks whether an error is a 404 or authorization/access failure.
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
 * @author Maruf Bepary
 */
export function isChatInStore(chatId: string): boolean {
  if (!chatId) return false;
  const chats = useAppStore.getState().chats;
  return Boolean(chats?.[chatId]);
}

/**
 * Ensures there is an assistant ID or parent ID to match against in DB sync.
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
 * @author Maruf Bepary
 */
export function resolveSyncTargetParentId(
  userMsgId: string | null,
  activeLeaf?: { id: string },
): string | undefined {
  if (userMsgId) return userMsgId;
  return activeLeaf ? activeLeaf.id : undefined;
}
