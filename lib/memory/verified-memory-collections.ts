/**
 * In-memory cache of verified collections to avoid redundant collectionExists calls.
 */
export const verifiedMemoryCollections = new Set<string>();
