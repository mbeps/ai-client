import { db } from "@/drizzle/db";
import { sql } from "drizzle-orm";
import { embedQuery } from "./embed";

const RRF_K = 60;

export type ChunkResult = {
  id: string;
  content: string;
  documentId: string;
  documentName: string;
  s3Key: string;
  chunkIndex: number;
  score: number;
};

type RawChunkRow = {
  id: string;
  content: string;
  document_id: string;
  chunk_index: number;
  document_name: string;
  s3_key: string;
};

export function applyRRF(
  vectorRows: RawChunkRow[],
  ftsRows: RawChunkRow[],
  topK: number,
): ChunkResult[] {
  const scoreMap = new Map<string, { row: RawChunkRow; score: number }>();

  vectorRows.forEach((row, idx) => {
    scoreMap.set(row.id, { row, score: 1 / (RRF_K + idx + 1) });
  });

  ftsRows.forEach((row, idx) => {
    const rrfScore = 1 / (RRF_K + idx + 1);
    const existing = scoreMap.get(row.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scoreMap.set(row.id, { row, score: rrfScore });
    }
  });

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ row, score }) => ({
      id: row.id,
      content: row.content,
      documentId: row.document_id,
      documentName: row.document_name,
      s3Key: row.s3_key,
      chunkIndex: row.chunk_index,
      score,
    }));
}

export async function hybridSearch(
  kbId: string,
  query: string,
  topK = 5,
): Promise<ChunkResult[]> {
  // SECURITY: kbId is always a server-resolved UUID from session-owned chat/project.
  // Both queries filter by kbId to prevent cross-user data leakage.

  let embedding: number[];
  try {
    embedding = await embedQuery(query);
  } catch (err) {
    console.error("[RAG] embedQuery failed:", err);
    throw err;
  }
  const embeddingLiteral = `[${embedding.join(",")}]`;

  const vectorRows = (
    await db.execute(sql`
      SELECT 
        c.id, 
        c.content, 
        c.document_id, 
        c.chunk_index,
        d.name as document_name,
        d.s3_key
      FROM kb_chunk c
      JOIN kb_document d ON c.document_id = d.id
      WHERE c.kb_id = ${kbId}
        AND c.embedding IS NOT NULL
      ORDER BY c.embedding <=> ${embeddingLiteral}::vector
      LIMIT 20
    `)
  ).rows as RawChunkRow[];

  let ftsRows: RawChunkRow[] = [];
  try {
    ftsRows = (
      await db.execute(sql`
        SELECT 
          c.id, 
          c.content, 
          c.document_id, 
          c.chunk_index,
          d.name as document_name,
          d.s3_key
        FROM kb_chunk c
        JOIN kb_document d ON c.document_id = d.id
        WHERE c.kb_id = ${kbId}
          AND c.search_vector @@ plainto_tsquery('english', ${query})
        ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('english', ${query})) DESC
        LIMIT 20
      `)
    ).rows as RawChunkRow[];
  } catch (err) {
    console.error("[RAG] FTS query failed:", err);
    ftsRows = [];
  }

  return applyRRF(vectorRows, ftsRows, topK);
}
