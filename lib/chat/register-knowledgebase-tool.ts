import { tool } from "ai";
import { PROMPTS } from "@/config/prompts";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { runKbSubagent } from "@/lib/rag/run-kb-subagent";
import { searchKnowledgeBaseSchema } from "@/schemas/chat/chat";

/**
 * Configuration options for the isolated Knowledge Base subagent.
 * Enables the orchestrator to pass the resolved chat or worker model and context
 * limits down to the isolated research loop.
 *
 * @author Maruf Bepary
 */
export interface KnowledgebaseSubagentConfig {
  /** Language model instance used to power the internal subagent tool loop. */
  model?: any;
  /** Maximum token context window of the model for context budget enforcement. */
  contextWindow?: number;
}

/**
 * Registers the internal search_knowledge_base tool for semantic, keyword,
 * and graph-guided retrieval across active knowledge bases attached to the conversation.
 *
 * Internally runs an isolated Knowledge Base reader subagent (`runKbSubagent`) with access
 * to graph traversal, chunk search, and bounded document reading tools. This preserves
 * the main chat context window by keeping raw multi-page document chunks isolated while
 * returning a synthesized answer, discovered document relationships, and structured
 * citations compatible with the chat UI citation preview components.
 *
 * @param targetKbIds - List of knowledge base IDs attached to the chat
 * @param kbIsReady - Whether the knowledge bases have finished indexing
 * @param userId - ID of the authenticated user
 * @param selectedTools - Optional list of tool IDs selected for this chat
 * @param subagentConfig - Optional model and context window config for isolated subagent execution
 * @returns Object with search_knowledge_base tool if eligible, empty object otherwise
 * @author Maruf Bepary
 */
export function registerKnowledgebaseTool(
  targetKbIds: string[],
  kbIsReady: boolean,
  userId: string,
  selectedTools?: string[],
  subagentConfig?: KnowledgebaseSubagentConfig,
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

        const subagentResult = await runKbSubagent({
          query: normalizedQuery,
          targetKbIds,
          userId,
          model: subagentConfig?.model,
          contextWindow: subagentConfig?.contextWindow,
        });

        if (subagentResult.results.length === 0 && !subagentResult.answer) {
          return {
            success: true,
            results: [],
            resultCount: 0,
            message: `No results found for '${normalizedQuery}'. Try using different keywords or broader search terms.`,
          };
        }

        return {
          success: true,
          results: subagentResult.results,
          resultCount: subagentResult.results.length,
          ...(subagentResult.answer ? { answer: subagentResult.answer } : {}),
          ...(subagentResult.relatedDocuments &&
          subagentResult.relatedDocuments.length > 0
            ? { relatedDocuments: subagentResult.relatedDocuments }
            : {}),
        };
      },
      toModelOutput: ({ output }: { output: any }) => {
        if (!output?.success) {
          return {
            type: "text",
            value: output?.error ?? "Failed to search knowledge base.",
          };
        }

        if (
          (!output?.results || output.results.length === 0) &&
          !output?.answer
        ) {
          return {
            type: "text",
            value:
              output?.message ??
              "No matching documents found in knowledge base.",
          };
        }

        if (output?.answer) {
          let text = `KNOWLEDGE BASE SYNTHESIS:\n${output.answer}\n`;

          if (output.relatedDocuments && output.relatedDocuments.length > 0) {
            text += `\nDOCUMENT RELATIONSHIPS:\n${output.relatedDocuments
              .map(
                (r: any) =>
                  `- "${r.sourceDocName}" ${r.relationType} "${r.targetDocName}"`,
              )
              .join("\n")}\n`;
          }

          if (output.results && output.results.length > 0) {
            text += `\nSOURCES:\n${output.results
              .map((r: any) => `- "${r.documentName}"`)
              .join("\n")}`;
          }

          return {
            type: "text",
            value: text.trim(),
          };
        }

        return {
          type: "text",
          value: output.results
            .map(
              (r: any, i: number) =>
                `[Source ${i + 1}: ${r.documentName}]\n${r.content}`,
            )
            .join("\n\n"),
        };
      },
    }),
  };
}
