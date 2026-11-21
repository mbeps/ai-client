import { chunkText } from "@/lib/rag/chunk-text";
import { extractTextFromBuffer } from "@/lib/rag/extract-text-server";
import { downloadObject } from "@/lib/storage/download-object";
import type { ScoredChunk } from "@/types/rag/chunk-result";

/**
 * Parameters for reading a range of deterministic document chunks from S3.
 *
 * @author Maruf Bepary
 */
export interface ReadS3DocumentChunksParams {
  /** Unique document UUID. */
  documentId: string;
  /** Original filename of the document. */
  documentName: string;
  /** MIME type used for text extraction. */
  mimeType: string;
  /** Object storage key in S3/MinIO. */
  s3Key: string;
  /** Knowledge base UUID where the document resides. */
  kbId: string;
  /** Optional 0-based inclusive start chunk index. */
  startIndex?: number;
  /** Optional 0-based inclusive end chunk index. */
  endIndex?: number;
  /** Optional per-turn cache mapping documentId to extracted chunks. */
  cache?: Map<string, string[]>;
}

/**
 * Fetches a document from S3/MinIO, extracts and chunks its text deterministically,
 * caches the chunk array per turn when a cache Map is provided, and returns the
 * inclusive `[startIndex, endIndex]` slice as `ScoredChunk[]`.
 *
 * @param params - Document metadata, optional slice bounds, and optional per-turn cache
 * @returns Ordered array of chunk slices matching the requested range
 * @author Maruf Bepary
 */
export async function readS3DocumentChunksByRange(
  params: ReadS3DocumentChunksParams,
): Promise<ScoredChunk[]> {
  const {
    documentId,
    documentName,
    mimeType,
    s3Key,
    kbId,
    startIndex,
    endIndex,
    cache,
  } = params;

  let chunks = cache?.get(documentId);
  if (!chunks) {
    const buffer = await downloadObject(s3Key);
    const text = await extractTextFromBuffer(buffer, mimeType);
    chunks = chunkText(text);
    cache?.set(documentId, chunks);
  }

  if (chunks.length === 0) {
    return [];
  }

  const start = Math.max(0, startIndex ?? 0);
  const maxIndex = chunks.length - 1;
  const end = Math.min(maxIndex, endIndex ?? maxIndex);

  if (start > end) {
    return [];
  }

  const sliced: ScoredChunk[] = [];
  for (let i = start; i <= end; i++) {
    sliced.push({
      id: `${documentId}:${i}`,
      content: chunks[i],
      documentId,
      documentName,
      s3Key,
      chunkIndex: i,
      kbId,
    });
  }

  return sliced;
}
