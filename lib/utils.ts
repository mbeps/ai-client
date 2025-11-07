import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges conditional class name inputs using `clsx` and Tailwind-aware merging.
 * @param inputs Class name values that may include booleans, arrays, or strings.
 * @returns A single deduplicated class name string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
