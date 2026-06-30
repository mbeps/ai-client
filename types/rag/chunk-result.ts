/**
 * Result of a hybrid search query (vector + full-text).
 * Includes chunk content, source document metadata, and relevance score.
 * @author Maruf Bepary
 */
export type ChunkResult = {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  s3Key: string;
  chunkIndex: number;
  score: number;
};
