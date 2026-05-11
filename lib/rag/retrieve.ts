import { db } from "@/drizzle/db";
import { sql } from "drizzle-orm";
import { embedQuery } from "./embed";

const RRF_K = 60;

export type ChunkResult = {
  id: string;
  content: string;
  documentId: string;
  chunkIndex: number;
  score: number;
};

type RawChunkRow = {
  id: string;
  content: string;
  document_id: string;
  chunk_index: number;
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
      SELECT id, content, document_id, chunk_index
      FROM kb_chunk
      WHERE kb_id = ${kbId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingLiteral}::vector
      LIMIT 20
    `)
  ).rows as RawChunkRow[];

  let ftsRows: RawChunkRow[] = [];
  try {
    ftsRows = (
      await db.execute(sql`
        SELECT id, content, document_id, chunk_index
        FROM kb_chunk
        WHERE kb_id = ${kbId}
          AND search_vector @@ plainto_tsquery('english', ${query})
        ORDER BY ts_rank_cd(search_vector, plainto_tsquery('english', ${query})) DESC
        LIMIT 20
      `)
    ).rows as RawChunkRow[];
  } catch (err) {
    console.error("[RAG] FTS query failed:", err);
    ftsRows = [];
  }

  return applyRRF(vectorRows, ftsRows, topK);
}
