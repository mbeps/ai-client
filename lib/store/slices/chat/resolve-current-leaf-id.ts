/**
 * Resolves the active leaf message ID for a chat during hydration.
 * Prioritizes incoming row leaf when incoming messages exist, else existing store leaf.
 *
 * @param rowLeafId - Leaf ID from database row
 * @param existingLeafId - Current leaf ID in store
 * @param hasIncomingMsgs - Whether incoming messages were provided for this chat
 * @returns Target leaf ID or null
 * @author Maruf Bepary
 */
export function resolveCurrentLeafId(
  rowLeafId: string | null | undefined,
  existingLeafId: string | null | undefined,
  hasIncomingMsgs: boolean,
): string | null {
  if (hasIncomingMsgs) {
    return rowLeafId ?? existingLeafId ?? null;
  }
  return existingLeafId ?? rowLeafId ?? null;
}
