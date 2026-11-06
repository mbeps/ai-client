import { cn as cnLib } from "cn";

/**
 * Merges Tailwind and conditional class names.
 *
 * @param inputs - Class names or expressions
 * @returns Combined class name string
 */
export function cn(...inputs: Parameters<typeof cnLib>): string {
  return cnLib(...inputs);
}
