import { generateText, isStepCount, tool } from "ai";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { getLogger } from "@/lib/logger";
import { exploreKbGraph } from "@/lib/rag/explore-kb-graph";
import { guardKbContextBudget } from "@/lib/rag/guard-kb-context-budget";
import { hybridSearch } from "@/lib/rag/hybrid-search";
import { getDocumentChunksByRange } from "@/lib/rag/qdrant-client";
import type { KbTocEntry } from "@/types/knowledgebase/kb-document-row";

const log = getLogger(["rag", "subagent"]);

const KB_SUBAGENT_SYSTEM_PROMPT =
  "You are an isolated Knowledge Base Research Subagent. " +
  "Your task is to answer the user's inquiry accurately, concisely, and exclusively using facts from the attached knowledge base. " +
  "You have access to tools: 'explore_kb_graph' to inspect document relationships, 'search_kb_chunks' to search specific chunks, and 'read_kb_document' to read document sections. " +
  "If the provided catalog and initial hits already answer the question, formulate a clear, direct answer immediately. " +
  "Synthesize your final findings clearly without inventing facts.";

/**
 * Parameters for executing the isolated Knowledge Base subagent.
 *
 * @author Maruf Bepary
 */
export interface RunKbSubagentParams {
  /** User's natural language search query. */
  query: string;
  /** List of knowledge base IDs attached to the conversation. */
  targetKbIds: string[];
  /** Authenticated user identifier for credential and provider lookup. */
  userId: string;
  /** Language model instance to drive the internal subagent tool loop (e.g. worker model or orchestrator fallback). */
  model?: any;
  /** Total token context window of the executing model for budget guarding (defaults to 16,384). */
  contextWindow?: number;
  /** Optional cancellation signal to terminate subagent execution. */
  abortSignal?: AbortSignal;
}

/**
 * Result returned by the Knowledge Base reader subagent.
 *
 * @author Maruf Bepary
 */
export interface RunKbSubagentResult {
  /** Synthesized answer formulated by the isolated subagent from retrieved facts. */
  answer?: string;
  /** Normalized citations preserved for UI citation pills and preview components. */
  results: Array<{
    /** Extracted textual excerpt or chunk content. */
    content: string;
    /** Relative relevance score (from RRF or vector similarity). */
    relevanceScore: number;
    /** Unique document UUID. */
    documentId: string;
    /** Original filename of the document. */
    documentName: string;
    /** Knowledge base UUID where the document resides. */
    kbId?: string;
    /** Knowledge base human-readable name. */
    kbName?: string;
  }>;
  /** Discovered relationship edges relevant to the synthesized response. */
  relatedDocuments?: Array<{
    /** Source document display name. */
    sourceDocName: string;
    /** Target document display name. */
    targetDocName: string;
    /** Directed semantic relationship (e.g., references, supersedes, supplements, contradicts, depicts). */
    relationType: string;
    /** Grounding reason for the semantic relationship. */
    reason: string;
  }>;
}

/**
 * Builds the initial context prompt for the internal KB reader subagent.
 *
 * @author Maruf Bepary
 */
function buildKbSubagentPrompt(
  query: string,
  initialHits: any[],
  graph: { documents: any[]; relations: any[] },
): string {
  const catalogSummary = graph.documents
    .slice(0, 15)
    .map(
      (d) =>
        `- [${d.id}] "${d.name}" (${d.documentType}, ${d.chunkCount} chunks): ${d.summary}`,
    )
    .join("\n");

  const relationSummary = graph.relations
    .slice(0, 15)
    .map(
      (r) =>
        `- "${r.sourceDocName}" ${r.relationType} "${r.targetDocName}" (${r.reason})`,
    )
    .join("\n");

  const hitSummary = initialHits
    .slice(0, 5)
    .map(
      (h, i) =>
        `[Hit ${i + 1}] Source: "${h.documentName}" (Score: ${Number(h.score ?? 1).toFixed(2)})\n${h.content}`,
    )
    .join("\n\n");

  return (
    `USER QUERY:\n${query}\n\n` +
    `TIER 1 DOCUMENT CATALOG:\n${catalogSummary || "None available."}\n\n` +
    `DOCUMENT RELATIONSHIPS:\n${relationSummary || "None available."}\n\n` +
    `INITIAL RETRIEVAL HITS:\n${hitSummary || "None available."}\n\n` +
    "Instructions: Use the initial hits or call tools if you need more details. Answer the query thoroughly."
  );
}

/**
 * Executes an isolated Knowledge Base reader subagent to retrieve, traverse,
 * and synthesize answers from multiple documents while protecting the orchestrator context.
 *
 * @param params - Search query, target KB IDs, user ID, language model, and optional context window
 * @returns Synthesized answer, collected citations, and discovered document relationships
 * @author Maruf Bepary
 */
export async function runKbSubagent(
  params: RunKbSubagentParams,
): Promise<RunKbSubagentResult> {
  const { query, targetKbIds, userId, model, contextWindow, abortSignal } =
    params;

  const kbTarget = targetKbIds.length === 1 ? targetKbIds[0] : targetKbIds;

  const [initialHits, initialGraph] = await Promise.all([
    hybridSearch(kbTarget, query, userId, 5),
    exploreKbGraph({ kbIds: targetKbIds }).catch((err) => {
      log.warn("exploreKbGraph failed during KB subagent prefetch: {err}", {
        err: String(err),
      });
      return { documents: [], relations: [] };
    }),
  ]);

  const collectedCitations = new Map<
    string,
    {
      content: string;
      relevanceScore: number;
      documentId: string;
      documentName: string;
      kbId?: string;
      kbName?: string;
    }
  >();

  const addCitation = (hit: {
    content: string;
    score?: number;
    relevanceScore?: number;
    documentId: string;
    documentName: string;
    kbId?: string;
    kbName?: string;
  }) => {
    const key = `${hit.documentId}:${hit.content.trim().slice(0, 100)}`;
    if (!collectedCitations.has(key)) {
      collectedCitations.set(key, {
        content: hit.content,
        relevanceScore: hit.relevanceScore ?? hit.score ?? 1.0,
        documentId: hit.documentId,
        documentName: hit.documentName,
        ...(hit.kbId ? { kbId: hit.kbId } : {}),
        ...(hit.kbName ? { kbName: hit.kbName } : {}),
      });
    }
  };

  for (const hit of initialHits) {
    addCitation(hit);
  }

  const relatedDocMap = new Map<
    string,
    {
      sourceDocName: string;
      targetDocName: string;
      relationType: string;
      reason: string;
    }
  >();

  for (const rel of initialGraph.relations) {
    const key = `${rel.sourceDocName}:${rel.targetDocName}:${rel.relationType}`;
    relatedDocMap.set(key, rel);
  }

  // Fast path if model is missing or no content exists
  if (
    !model ||
    (initialHits.length === 0 && initialGraph.documents.length === 0)
  ) {
    return {
      results: Array.from(collectedCitations.values()),
      relatedDocuments: Array.from(relatedDocMap.values()),
    };
  }

  let usedTokens = 0;

  const internalTools = {
    explore_kb_graph: tool({
      description:
        "Traverse or search document relationship edges in the knowledge base graph.",
      inputSchema: z.object({
        query: z.string().optional(),
        startDocId: z.string().optional(),
        depth: z.number().int().min(1).max(3).optional(),
      }),
      execute: async (args) => {
        const graphResult = await exploreKbGraph({
          kbIds: targetKbIds,
          query: args.query,
          startDocId: args.startDocId,
          depth: args.depth,
        });
        for (const rel of graphResult.relations) {
          const key = `${rel.sourceDocName}:${rel.targetDocName}:${rel.relationType}`;
          relatedDocMap.set(key, rel);
        }
        return graphResult;
      },
    }),
    search_kb_chunks: tool({
      description:
        "Retrieve specific semantic and keyword chunks filtered by query and optional document IDs.",
      inputSchema: z.object({
        query: z.string(),
        documentIds: z.array(z.string()).optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: async (args) => {
        const hits = await hybridSearch(
          kbTarget,
          args.query,
          userId,
          args.limit ?? 5,
          args.documentIds,
        );
        for (const hit of hits) {
          addCitation(hit);
        }
        return {
          chunks: hits.map((h) => ({
            content: h.content,
            documentId: h.documentId,
            documentName: h.documentName,
            score: h.score,
          })),
        };
      },
    }),
    read_kb_document: tool({
      description:
        "Read an entire document or specific chunk slice from the knowledge base with context protection.",
      inputSchema: z.object({
        documentId: z.string(),
        chunkStartIndex: z.number().int().min(0).optional(),
        chunkEndIndex: z.number().int().min(0).optional(),
      }),
      execute: async (args) => {
        let docNode = initialGraph.documents.find(
          (d) => d.id === args.documentId,
        );

        if (!docNode) {
          const [foundDoc] = await db
            .select()
            .from(kbDocument)
            .where(
              and(
                eq(kbDocument.id, args.documentId),
                inArray(kbDocument.kbId, targetKbIds),
              ),
            );

          if (!foundDoc) {
            return { safeToRead: false, error: "Document not found." };
          }

          docNode = {
            id: foundDoc.id,
            name: foundDoc.name,
            documentType: foundDoc.documentType ?? "general",
            summary: foundDoc.summary ?? "",
            keyEntities: (foundDoc.keyEntities as string[]) ?? [],
            chunkCount: foundDoc.chunkCount ?? 0,
            tokenCount: foundDoc.tokenCount ?? 0,
            tableOfContents: (foundDoc.tableOfContents as KbTocEntry[]) ?? [],
          };
        }

        const budgetCheck = guardKbContextBudget({
          targetDoc: docNode,
          modelContextWindow: contextWindow,
          usedTokens,
          chunkStartIndex: args.chunkStartIndex,
          chunkEndIndex: args.chunkEndIndex,
        });

        if (!budgetCheck.safeToRead) {
          return {
            safeToRead: false,
            message:
              "Reading this section exceeds context window budget. Please inspect the outline and specify a smaller chunkStartIndex and chunkEndIndex range.",
            outline: budgetCheck.outlineFallback,
            chunkCount: docNode.chunkCount,
          };
        }

        usedTokens += budgetCheck.estimatedSliceTokens;
        const chunks = await getDocumentChunksByRange(
          args.documentId,
          targetKbIds,
          args.chunkStartIndex,
          args.chunkEndIndex,
        );

        for (const chunk of chunks) {
          addCitation({
            content: chunk.content,
            relevanceScore: 1.0,
            documentId: args.documentId,
            documentName: docNode.name,
            kbId: chunk.kbId,
            kbName: chunk.kbName,
          });
        }

        return {
          safeToRead: true,
          documentName: docNode.name,
          chunks: chunks.map((c) => ({
            chunkIndex: c.chunkIndex,
            content: c.content,
          })),
        };
      },
    }),
  };

  try {
    const result = await generateText({
      model,
      system: KB_SUBAGENT_SYSTEM_PROMPT,
      prompt: buildKbSubagentPrompt(query, initialHits, initialGraph),
      tools: internalTools,
      stopWhen: isStepCount(4),
      abortSignal,
    });

    return {
      ...(result.text?.trim() ? { answer: result.text.trim() } : {}),
      results: Array.from(collectedCitations.values()),
      relatedDocuments: Array.from(relatedDocMap.values()),
    };
  } catch (err) {
    log.warn(
      "KB subagent generateText failed, falling back to collected hits: {err}",
      { err: String(err) },
    );
    return {
      results: Array.from(collectedCitations.values()),
      relatedDocuments: Array.from(relatedDocMap.values()),
    };
  }
}
