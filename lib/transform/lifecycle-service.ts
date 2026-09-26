/**
 * Validation utilities for transform runs.
 *
 * @author Maruf Bepary
 */

/**
 * Validates that step order values form a contiguous 0-based integer sequence.
 * Throws if orders have gaps, duplicates, or don't start at 0.
 * Required so resume logic (`currentStepIndex + 1`) maps correctly to array indices.
 */
export function validateStepOrders(orders: number[]): void {
  if (orders.length === 0) return;
  const sorted = [...orders].sort((a, b) => a - b);
  const isContiguous = sorted.every((o, idx) => o === idx);
  if (!isContiguous) {
    throw new Error(
      `Step orders must be contiguous 0-based integers (got [${sorted.join(", ")}])`,
    );
  }
}
