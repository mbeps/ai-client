/**
 * A version of Omit that distributes over unions.
 * When applied to a union T1 | T2, Omit results in a type that only has common properties.
 * DistributiveOmit results in Omit<T1, K> | Omit<T2, K>.
 */
export type DistributiveOmit<T, K extends keyof any> = T extends any
  ? Omit<T, K>
  : never;
