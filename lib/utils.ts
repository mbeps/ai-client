export { cn } from "cn";

export interface SortableResource {
  id: string;
  updatedAt: Date;
}

/**
 * Sorts an array of resources by their updatedAt timestamp in descending order (newest first).
 * Does not mutate the original array.
 */
export function sortByUpdatedAt<T extends SortableResource>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}

/**
 * Extracts non-empty segments from a URL pathname.
 */
export function getPathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

/**
 * Returns a new Set with the item removed if present, or added if absent.
 * Does not mutate the original set.
 */
export function toggleSetItem<T>(set: ReadonlySet<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}
