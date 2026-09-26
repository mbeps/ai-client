/**
 * A helper that preserves union discrimination when omitting keys.
 * Used for safe type transformations without losing type narrowing.
 *
 * @author Maruf Bepary
 */
export type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;
