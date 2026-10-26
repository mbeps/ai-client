import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { getLogger } from "@/lib/logger";
import { searchKeywordMemories } from "@/lib/memory/search-keyword-memories";
import { searchSemanticMemories } from "@/lib/memory/search-semantic-memories";
import { embedQuery } from "@/lib/rag/embed-query";
import { getUserSettingsByUserId } from "@/lib/user/get-user-settings-by-id";

const log = getLogger(["app", "memory", "service"]);

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
  const settings = await getUserSettingsByUserId(userId).catch(() => null);
  if (settings && settings.memoryEnabled === false) {
    return [];
  }

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
