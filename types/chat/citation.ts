/**
 * Represents a single knowledge base document citation extracted from RAG search results.
 * Used to attribute content sources and provide relevance scoring in message rendering.
 *
 * @typedef {Object} Citation
 * @property {string} content - Text excerpt from the document that was retrieved
 * @property {number} relevanceScore - Semantic similarity score (0-1 range), higher = more relevant
 * @property {string} documentId - Unique identifier of the document in the knowledge base
 * @property {string} documentName - Human-readable name of the document for display
 * @property {string} s3Key - S3 object key for storage/retrieval of the original document file
 *
 * @author Maruf Bepary
 */
export type Citation = {
  content: string;
  relevanceScore: number;
  documentId: string;
  documentName: string;
  s3Key: string;
};
