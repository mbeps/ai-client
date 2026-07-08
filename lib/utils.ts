import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { TimedResource } from "@/types/shared/resource";

/**
 * Intelligently merges Tailwind CSS class names, resolving conflicts and deduplicating utilities.
 * Accepts conditional inputs (booleans, objects, arrays) via clsx, then applies Tailwind-aware
 * merging so conflicting utilities are resolved with the last value winning.
 * Use this in component className props whenever combining static and dynamic Tailwind classes.
 *
 * @param inputs - Variable number of class name values: strings, booleans, objects, or arrays.
 * @returns A single merged class name string with conflicts resolved and duplicates removed.
 * @example
 * cn("px-2", "px-4")  // "px-4" (last px- wins)
 * cn("p-4", { "p-2": true })  // "p-2"
 * cn(["m-1", "m-2"], isActive && "bg-blue-500")  // "m-2 bg-blue-500"
 * @author Maruf Bepary
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
