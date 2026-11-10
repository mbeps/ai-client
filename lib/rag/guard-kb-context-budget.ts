import type { KbTocEntry } from "@/types/knowledgebase/kb-document-row";

/**
 * Parameters for evaluating whether reading a document or slice fits within model context budget.
 *
 * @author Maruf Bepary
 */
export interface GuardKbContextBudgetParams {
  targetDoc: {
    tokenCount: number;
    chunkCount: number;
    tableOfContents: KbTocEntry[];
  };
  modelContextWindow?: number;
  usedTokens: number;
  chunkStartIndex?: number;
  chunkEndIndex?: number;
}

/**
 * Result of the context budget guard check.
 *
 * @author Maruf Bepary
 */
export interface GuardKbContextBudgetResult {
  safeToRead: boolean;
  estimatedSliceTokens: number;
  usableBudget: number;
  outlineFallback?: KbTocEntry[];
}

/**
 * Evaluates whether reading a full document or chunk slice will stay within
 * 75% of the model's total context window to avoid context blowout.
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
