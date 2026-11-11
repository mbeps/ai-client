import type { KbTocEntry } from "@/types/knowledgebase/kb-document-row";

/**
 * Parameters for evaluating whether reading a document or slice fits within model context budget.
 * Used by internal tools (such as `read_kb_document` within `runKbSubagent`) to prevent
 * blowing out the context window when reading large documents.
 *
 * @author Maruf Bepary
 */
export interface GuardKbContextBudgetParams {
  /** Target document metrics and structural table of contents. */
  targetDoc: {
    tokenCount: number;
    chunkCount: number;
    tableOfContents: KbTocEntry[];
  };
  /** Total context window of the executing chat model in tokens (defaults to 16,384). */
  modelContextWindow?: number;
  /** Estimated tokens already consumed in the subagent's conversation history. */
  usedTokens: number;
  /** Optional 0-based chunk start index for sliced range reads. */
  chunkStartIndex?: number;
  /** Optional 0-based chunk end index (inclusive) for sliced range reads. */
  chunkEndIndex?: number;
}

/**
 * Result of the context budget guard check.
 *
 * @author Maruf Bepary
 */
export interface GuardKbContextBudgetResult {
  /** Whether the full document or requested slice can be safely read within budget. */
  safeToRead: boolean;
  /** Estimated tokens required to read the requested document or slice. */
  estimatedSliceTokens: number;
  /** Remaining usable token budget after reserving a 25% safety margin and accounting for used tokens. */
  usableBudget: number;
  /** Structural table of contents provided as an outline fallback when safeToRead is false. */
  outlineFallback?: KbTocEntry[];
}

/**
 * Evaluates whether reading a full document or chunk slice will stay within
 * 75% of the model's total context window to avoid context blowout.
 *
 * When the document exceeds the usable budget (`floor(contextWindow * 0.75) - usedTokens`),
 * this guard rejects full document reads (`safeToRead: false`) and returns the document's
 * structural `tableOfContents` as an outline fallback. This guides the subagent to read
 * targeted `[chunkStartIndex, chunkEndIndex]` slices instead of consuming the whole window.
 *
 * @param params - Document stats, model context limit, used tokens, and slice range
 * @returns Object with safeToRead boolean, estimated tokens, and outlineFallback if blocked
 * @author Maruf Bepary
 */
export function guardKbContextBudget(
  params: GuardKbContextBudgetParams,
): GuardKbContextBudgetResult {
  const {
    targetDoc,
    modelContextWindow = 16_384,
    usedTokens,
    chunkStartIndex,
    chunkEndIndex,
  } = params;

  const totalAllowed = Math.floor(modelContextWindow * 0.75);
  const usableBudget = totalAllowed - usedTokens;

  const isSliceRequested =
    chunkStartIndex !== undefined || chunkEndIndex !== undefined;

  let estimatedSliceTokens: number;

  if (isSliceRequested) {
    const startIndex = Math.max(0, chunkStartIndex ?? 0);
    const maxIndex = Math.max(0, targetDoc.chunkCount - 1);
    const endIndex = Math.min(maxIndex, chunkEndIndex ?? maxIndex);
    const sliceLength = Math.max(0, endIndex - startIndex + 1);

    const tokensPerChunk =
      targetDoc.tokenCount / Math.max(1, targetDoc.chunkCount);
    estimatedSliceTokens = Math.ceil(tokensPerChunk * sliceLength);
  } else {
    estimatedSliceTokens = targetDoc.tokenCount;
  }

  const safeToRead = estimatedSliceTokens <= usableBudget && usableBudget >= 0;

  return {
    safeToRead,
    estimatedSliceTokens,
    usableBudget,
    ...(safeToRead ? {} : { outlineFallback: targetDoc.tableOfContents }),
  };
}
