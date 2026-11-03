/**
 * Resolves the creation date for a chat, prioritizing the database row.
 *
 * @param rowDate - Creation date from the database row
 * @param existingDate - Existing creation date in store if present
 * @returns Date object or undefined
 * @author Maruf Bepary
 */
export function resolveCreatedAt(
  rowDate: Date | string | null | undefined,
  existingDate: Date | undefined,
): Date | undefined {
  if (rowDate) return new Date(rowDate);
  return existingDate;
}
