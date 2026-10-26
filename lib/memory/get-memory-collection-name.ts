/**
 * Derives the collection name for user memories given vector dimensionality.
 *
 * @param dimensions - Vector dimensionality of the embedding model
 * @returns The Qdrant collection name
 * @author Maruf Bepary
 */
export function getMemoryCollectionName(dimensions: number): string {
  return `user_memories_${dimensions}`;
}
