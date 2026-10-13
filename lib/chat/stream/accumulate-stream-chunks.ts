/**
 * Utility functions for accumulating text and reasoning stream deltas.
 * @author Maruf Bepary
 */

/**
 * Appends streaming text delta chunk to accumulator and returns updated text.
 * @param current - Current accumulated text
 * @param delta - Incoming text fragment
 * @returns Updated accumulated text
 * @author Maruf Bepary
 */
export function accumulateTextDelta(current: string, delta: string): string {
  return current + delta;
}

/**
 * Appends streaming reasoning delta chunk to accumulator and returns updated reasoning.
 * @param current - Current accumulated reasoning
 * @param delta - Incoming reasoning fragment
 * @returns Updated accumulated reasoning
 * @author Maruf Bepary
 */
export function accumulateReasoningDelta(
  current: string,
  delta: string,
): string {
  return current + delta;
}
