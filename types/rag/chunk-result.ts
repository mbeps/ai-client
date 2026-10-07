/**
 * Scored chunk retrieved from a single Qdrant query modality (semantic or keyword).
 * All chunk text and denormalized metadata are in camelCase.
 * @author Maruf Bepary
 */
export type ScoredChunk = {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  s3Key: string;
  chunkIndex: number;
  kbId?: string;
  kbName?: string;
};

/**
 * Result of a hybrid search query (vector + full-text).
 * Includes chunk content, source document metadata, and combined relevance score.
 * @author Maruf Bepary
 */
export type ChunkResult = ScoredChunk & {
  score: number;
};
