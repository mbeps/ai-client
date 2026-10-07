import { tool } from "ai";
import { PROMPTS } from "@/config/prompts";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { hybridSearch } from "@/lib/rag/hybrid-search";
import { searchKnowledgeBaseSchema } from "@/schemas/chat/chat";

/**
 * Registers the internal search_knowledge_base tool for semantic and keyword retrieval
 * across active knowledge bases attached to the conversation.
 *
 * @param targetKbIds - List of knowledge base IDs attached to the chat
 * @param kbIsReady - Whether the knowledge bases have finished indexing
 * @param userId - ID of the authenticated user
 * @param selectedTools - Optional list of tool IDs selected for this chat
 * @returns Object with search_knowledge_base tool if eligible, empty object otherwise
 * @author Maruf Bepary
 */
export function registerKnowledgebaseTool(
  targetKbIds: string[],
  kbIsReady: boolean,
  userId: string,
  selectedTools?: string[],
): Record<string, any> {
  const isGated =
    targetKbIds.length > 0 &&
    kbIsReady &&
    (selectedTools === undefined ||
      selectedTools.includes(INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE) ||
      selectedTools.includes("search_knowledge_base"));

  if (!isGated) {
    return {};
  }

  return {
    search_knowledge_base: tool({
      description: PROMPTS.TOOLS.SEARCH_KNOWLEDGE_BASE.DESCRIPTION,
      inputSchema: searchKnowledgeBaseSchema,
      execute: async (args) => {
        const { query } = args;
        const normalizedQuery = (query || "").trim();

        if (!normalizedQuery) {
          return {
            success: false,
            error:
              "Missing mandatory 'query' parameter. Search requires a specific keyword or phrase.",
          };
        }

        const results = await hybridSearch(
          targetKbIds.length === 1 ? targetKbIds[0] : targetKbIds,
          normalizedQuery,
          userId,
          5,
        );

        if (results.length === 0) {
          return {
            success: true,
            results: [],
            resultCount: 0,
            message: `No results found for '${normalizedQuery}'. Try using different keywords or broader search terms.`,
          };
        }

        return {
          success: true,
          results: results.map((r) => ({
            content: r.content,
            relevanceScore: r.score,
            documentId: r.documentId,
            documentName: r.documentName,
            ...(r.kbId ? { kbId: r.kbId } : {}),
            ...(r.kbName ? { kbName: r.kbName } : {}),
          })),
          resultCount: results.length,
        };
      },
    }),
  };
}
