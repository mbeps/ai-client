import { isCompactionMessage } from "@/lib/chat/is-compaction-message";

/**
 * Slices a reconstructed message thread from the latest compaction checkpoint.
 * Used identically by LLM prompt preparation, live context token estimation,
 * and compaction itself so UI and backend boundaries never drift.
 *
 * @param thread - Ordered message thread from root to active leaf
 * @returns Latest compaction message/summary (if any) and active post-compaction messages
 * @author Maruf Bepary
 */
export function sliceThreadFromLatestCompaction<
  T extends { role: string; content: string; metadata?: string | null },
>(
  thread: T[],
): {
  compactionMessage?: T;
  compactionSummary?: string;
  activeMessages: T[];
} {
  for (let i = thread.length - 1; i >= 0; i--) {
    if (isCompactionMessage(thread[i])) {
      return {
        compactionMessage: thread[i],
        compactionSummary: thread[i].content,
        activeMessages: thread.slice(i + 1),
      };
    }
  }
  return { activeMessages: thread };
}
