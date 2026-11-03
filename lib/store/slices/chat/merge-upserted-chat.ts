import type { Chat } from "@/types/chat/chat";

/**
 * Pure state builder for upserting a Chat domain object while preserving existing messages if omitted.
 *
 * @param existing - Existing Chat domain object in store if present
 * @param incoming - Incoming Chat domain object to upsert
 * @returns Merged Chat domain object
 * @author Maruf Bepary
 */
export function mergeUpsertedChat(
  existing: Chat | undefined,
  incoming: Chat,
): Chat {
  const hasIncomingMessages =
    incoming.messages && Object.keys(incoming.messages).length > 0;

  return {
    ...incoming,
    messages: hasIncomingMessages
      ? incoming.messages
      : (existing?.messages ?? {}),
    currentLeafId: hasIncomingMessages
      ? incoming.currentLeafId
      : (existing?.currentLeafId ?? incoming.currentLeafId ?? null),
  };
}
