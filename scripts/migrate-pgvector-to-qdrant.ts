import { sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  ensureQdrantCollection,
  getCollectionName,
  type QdrantChunkPayload,
  qdrantClient,
  upsertChunkPoints,
} from "@/lib/rag/qdrant-client";

type ChunkMigrationRow = {
  id: string;
  content: string;
  chunk_index: number;
  token_count: number;
  kb_id: string;
  document_id: string;
  document_name: string;
  s3_key: string;
  kb_name: string;
  embedding_str: string;
};

async function main() {
  console.log("🚀 Starting pgvector to Qdrant migration...");

  // 1. Query existing chunks with embeddings from PostgreSQL
  const res = await db.execute(sql`
    SELECT 
      c.id, 
      c.content, 
      c.chunk_index, 
      c.token_count, 
      c.kb_id, 
      c.document_id,
      d.name as document_name,
      d.s3_key,
      k.name as kb_name,
      c.embedding::text as embedding_str
    FROM kb_chunk c
    JOIN kb_document d ON c.document_id = d.id
    JOIN knowledgebase k ON c.kb_id = k.id
    WHERE c.embedding IS NOT NULL;
  `);

  const rows = res.rows as unknown as ChunkMigrationRow[];
  console.log(
    `📦 Found ${rows.length} chunk rows with vector embeddings in PostgreSQL.`,
  );

  if (rows.length === 0) {
    console.log("✅ No chunks to migrate. Done.");
    process.exit(0);
  }

  // 2. Group by vector dimension
  const pointsByDim = new Map<
    number,
    Array<{ id: string; vector: number[]; payload: QdrantChunkPayload }>
  >();

  for (const row of rows) {
    let vector: number[];
    try {
      vector = JSON.parse(row.embedding_str);
    } catch {
      // Fallback if not standard JSON string
      const trimmed = row.embedding_str.replace(/[[\]]/g, "").trim();
      vector = trimmed ? trimmed.split(",").map(Number) : [];
    }

    if (!vector.length) {
      console.warn(`⚠️ Skipping chunk ${row.id}: empty embedding.`);
      continue;
    }

    const dim = vector.length;
    if (!pointsByDim.has(dim)) {
      pointsByDim.set(dim, []);
    }

    pointsByDim.get(dim)!.push({
      id: row.id,
      vector,
      payload: {
        content: row.content,
        kbId: row.kb_id,
        documentId: row.document_id,
        chunkIndex: row.chunk_index,
        tokenCount: row.token_count,
        documentName: row.document_name,
        kbName: row.kb_name,
        s3Key: row.s3_key,
      },
    });
  }

  // 3. Upsert into Qdrant collections
  for (const [dim, points] of pointsByDim.entries()) {
    const colName = getCollectionName(dim);
    console.log(
      `📤 Migrating ${points.length} points to Qdrant collection "${colName}"...`,
    );

    await ensureQdrantCollection(dim);
    await upsertChunkPoints(dim, points);

    // Verify point count
    const info = await qdrantClient.getCollection(colName);
    console.log(
      `✅ Collection "${colName}" ready. Points in Qdrant: ${info.points_count}`,
    );
  }

  console.log("🎉 Migration completed successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
