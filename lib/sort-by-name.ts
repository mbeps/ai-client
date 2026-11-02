/**
 * Represents a resource with a name property that can be sorted alphabetically.
 *
 * @author Maruf Bepary
 */
export interface NamedResource {
  name: string;
}

/**
 * Represents a resource with a title property that can be sorted alphabetically.
 *
 * @author Maruf Bepary
 */
export interface TitledResource {
  title: string;
}

/**
 * Sorts an array of resources alphabetically by their name in ascending order (A-Z).
 * Uses case-insensitive comparison with sensitive tie-breaking for deterministic ordering.
 * Does not mutate the original array.
 *
 * @param items - Target items to sort
 * @returns A new array sorted alphabetically by name
 * @author Maruf Bepary
 */
export function sortByName<T extends NamedResource>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) ||
      a.name.localeCompare(b.name),
  );
}

/**
 * Sorts an array of resources alphabetically by their title in ascending order (A-Z).
 * Uses case-insensitive comparison with sensitive tie-breaking for deterministic ordering.
 * Does not mutate the original array.
 *
 * @param items - Target items to sort
 * @returns A new array sorted alphabetically by title
 * @author Maruf Bepary
 */
export function sortByTitle<T extends TitledResource>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
      a.title.localeCompare(b.title),
  );
}
