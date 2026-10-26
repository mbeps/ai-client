import { verifiedMemoryCollections } from "@/lib/memory/verified-memory-collections";

/**
 * Clears the in-memory verified collections cache (used in tests).
 *
 * @author Maruf Bepary
 */
export function clearMemoryCollectionCache(): void {
  verifiedMemoryCollections.clear();
}
