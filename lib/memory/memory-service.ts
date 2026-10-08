import { and, desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { getLogger } from "@/lib/logger";
import {
  deleteMemoryPoint,
  searchKeywordMemories,
  searchSemanticMemories,
  upsertMemoryPoint,
} from "@/lib/memory/qdrant-memory-client";
import { embedQuery } from "@/lib/rag/embed-query";
import type { Memory } from "@/types/memory/memory";

const log = getLogger(["app", "memory", "service"]);

/**
 * Saves a new user memory in PostgreSQL and attempts to index it into Qdrant.
 * If the user's embedding provider is not configured or fails, the memory is still
 * persisted in PostgreSQL and a warning is logged.
 *
 * @param userId - ID of the owning user
 * @param content - Text memory content
 * @returns The persisted Memory object
 * @author Maruf Bepary
 */
export async function saveMemoryForUser(
  userId: string,
  content: string,
): Promise<Memory> {
  const [inserted] = await db
    .insert(userMemory)
    .values({
      userId,
      content,
    })
    .returning();

  try {
    const vector = await embedQuery(content, userId);
    await upsertMemoryPoint(vector.length, {
      id: inserted.id,
      vector,
      userId,
      content,
    });
  } catch (err) {
    log.warn(
      "Failed to index memory into Qdrant (embedding unavailable): {error}",
      {
        error: err instanceof Error ? err.message : String(err),
        userId,
      },
    );
  }

  return {
    id: inserted.id,
    userId: inserted.userId,
    content: inserted.content,
    createdAt: new Date(inserted.createdAt),
    updatedAt: new Date(inserted.updatedAt),
  };
}

/**
 * Updates an existing memory in PostgreSQL and re-indexes it into Qdrant.
 *
 * @param userId - ID of the owning user
 * @param id - Memory UUID
 * @param content - New memory content
 * @returns The updated Memory object
 * @throws Error if the memory does not exist or does not belong to the user
 * @author Maruf Bepary
 */
export async function updateMemoryForUser(
  userId: string,
  id: string,
  content: string,
): Promise<Memory> {
  const [updated] = await db
    .update(userMemory)
    .set({
      content,
    })
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error("Memory not found");
  }

  try {
    const vector = await embedQuery(content, userId);
    await upsertMemoryPoint(vector.length, {
      id: updated.id,
      vector,
      userId,
      content,
    });
  } catch (err) {
    log.warn(
      "Failed to re-index memory in Qdrant (embedding unavailable): {error}",
      {
        error: err instanceof Error ? err.message : String(err),
        userId,
      },
    );
  }

  return {
    id: updated.id,
    userId: updated.userId,
    content: updated.content,
    createdAt: new Date(updated.createdAt),
    updatedAt: new Date(updated.updatedAt),
  };
}

/**
 * Deletes a user memory from PostgreSQL and removes its point from Qdrant.
 *
 * @param userId - ID of the owning user
 * @param id - Memory UUID
 * @author Maruf Bepary
 */
export async function deleteMemoryForUser(
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(userMemory)
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, userId)));

  try {
    await deleteMemoryPoint(id);
  } catch (err) {
    log.warn("Failed to delete memory point from Qdrant: {error}", {
      error: err instanceof Error ? err.message : String(err),
      userId,
      id,
    });
  }
}

/**
 * Retrieves relevant memories for a user during chat context loading.
 * If user has <= 20 memories or query is empty, all memories are loaded directly from PostgreSQL (instant 100% recall).
 * If user has > 20 memories and a search query is provided, hybrid search (semantic + full-text in Qdrant) is used.
 * Falls back to recent memories if hybrid search encounters any error.
 *
 * @param userId - ID of the user
 * @param query - Optional search query (e.g. latest user message)
 * @param limit - Maximum memories to return (default: 10)
 * @returns Array of memory content strings
 * @author Maruf Bepary
 */
export async function retrieveRelevantMemories(
  userId: string,
  query?: string,
  limit = 10,
): Promise<string[]> {
  const allRows = await db
    .select({ content: userMemory.content })
    .from(userMemory)
    .where(eq(userMemory.userId, userId))
    .orderBy(desc(userMemory.updatedAt));

  if (allRows.length === 0) {
    return [];
  }

  // Small memory bank or no query: return all directly up to limit
  if (allRows.length <= 20 || !query?.trim()) {
    return allRows.slice(0, limit).map((r) => r.content);
  }

  const normalizedQuery = query.trim();

  try {
    const vector = await embedQuery(normalizedQuery, userId);
    const [semanticResults, keywordResults] = await Promise.all([
      searchSemanticMemories(vector.length, vector, userId, limit * 2).catch(
        () => [],
      ),
      searchKeywordMemories(
        vector.length,
        normalizedQuery,
        userId,
        limit * 2,
      ).catch(() => []),
    ]);

    // Reciprocal Rank Fusion on memory items
    const scoreMap = new Map<string, { content: string; score: number }>();
    const RRF_K = 60;

    semanticResults.forEach((m, idx) => {
      scoreMap.set(m.id, {
        content: m.content,
        score: 1 / (RRF_K + idx + 1),
      });
    });

    keywordResults.forEach((m, idx) => {
      const rrfScore = 1 / (RRF_K + idx + 1);
      const existing = scoreMap.get(m.id);
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(m.id, { content: m.content, score: rrfScore });
      }
    });

    if (scoreMap.size === 0) {
      return allRows.slice(0, limit).map((r) => r.content);
    }

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.content);
  } catch (err) {
    log.warn(
      "Hybrid memory search failed; falling back to recent memories: {error}",
      {
        error: err instanceof Error ? err.message : String(err),
        userId,
      },
    );
    return allRows.slice(0, limit).map((r) => r.content);
  }
}
