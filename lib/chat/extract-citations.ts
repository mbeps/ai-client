import { ToolResult } from "@/types/chat/tool-result";
import { Citation } from "@/types/chat/citation";

/**
 * Extracts RAG citations from tool results by identifying search_knowledge_base outputs.
 * Flattens citations from all matching tool results into a single array for message rendering.
 * Used to display document sources and relevance scores to the user.
 *
 * @param {ToolResult[]} toolResults - Array of tool execution results from message metadata
 * @returns {Citation[]} Array of extracted citations; empty array if no search results found
 * @see {@link Citation} for citation type structure
 * @author Maruf Bepary
 */
export function extractCitations(toolResults: ToolResult[]): Citation[] {
  const citations: Citation[] = [];

  for (const tr of toolResults) {
    if (tr.toolName === "search_knowledge_base") {
      const data = tr.result as { results?: Citation[] };
      if (Array.isArray(data?.results)) {
        citations.push(...data.results);
      }
    }
  }

  return citations;
}
