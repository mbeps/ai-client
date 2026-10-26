/**
 * Returns a new Set with the item removed if present, or added if absent. Does not mutate the original set.
 *
 * @param set - Target set
 * @param item - Target item
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function toggleSetItem<T>(set: ReadonlySet<T>, item: T): Set<T> {
  const next = new Set(set);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}
