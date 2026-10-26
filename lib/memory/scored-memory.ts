/**
 * A memory item returned from a Qdrant search with an optional relevance score.
 *
 * @author Maruf Bepary
 */
export interface ScoredMemory {
  id: string;
  content: string;
  score?: number;
}
