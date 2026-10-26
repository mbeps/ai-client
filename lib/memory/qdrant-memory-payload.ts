/**
 * Payload stored alongside vectors for user memories.
 *
 * @author Maruf Bepary
 */
export interface QdrantMemoryPayload {
  id: string;
  userId: string;
  content: string;
}
