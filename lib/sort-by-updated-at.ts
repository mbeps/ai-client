import type { SortableResource } from "@/lib/sortable-resource";

/**
 * Sorts an array of resources by their updatedAt timestamp in descending order (newest first).
 * Does not mutate the original array.
 */
export function sortByUpdatedAt<T extends SortableResource>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}
