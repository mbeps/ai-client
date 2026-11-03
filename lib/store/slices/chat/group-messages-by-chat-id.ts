import type { MessageRow } from "@/types/message/message-row";

/**
 * Groups an array of raw database message rows by their parent chat ID.
 *
 * @param messageRows - List of raw message rows from the database
 * @returns Map where the key is chatId and value is the list of message rows for that chat
 * @author Maruf Bepary
 */
export function groupMessagesByChatId(
  messageRows: MessageRow[],
): Map<string, MessageRow[]> {
  const grouped = new Map<string, MessageRow[]>();
  for (const message of messageRows) {
    const list = grouped.get(message.chatId);
    if (list) {
      list.push(message);
    } else {
      grouped.set(message.chatId, [message]);
    }
  }
  return grouped;
}
