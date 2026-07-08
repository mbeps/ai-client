import { BaseResource } from "../shared/resource";

/**
 * Raw chunk database row (before transformation to ChunkResult).
 * @author Maruf Bepary
 */
export type RawChunkRow = {
  id: string; // Maintain explicit id for raw SQL cast compatibility
  content: string;
  document_id: string;
  chunk_index: number;
  document_name: string;
  s3_key: string;
} & BaseResource;
