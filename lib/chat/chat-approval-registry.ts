import type { ApprovalDecision } from "@/types/tool/approval";

interface ApprovalWaiter {
  expectedApprovalIds: readonly string[];
  resolve: (decisions: Map<string, boolean>) => void;
  reject: (reason: Error) => void;
  cleanup: () => void;
}

/**
 * In-memory registry coordinating in-flight subagent tool approval pauses
 * within an active Inngest chat generation run.
 *
 * Mirrors `chatAbortRegistry`: allows `respondToToolApproval` to immediately
 * unblock a waiting subagent step without spawning a new Inngest resume event.
 */
class ChatApprovalRegistry {
  private waiters = new Map<string, ApprovalWaiter>();

  /**
   * Registers a waiter for `assistantMessageId` and resolves once all
   * `expectedApprovalIds` are answered via `resolve()`.
   *
   * Rejects immediately if `abortSignal` is already aborted or aborts while waiting.
   */
  waitForDecisions(
    assistantMessageId: string,
    expectedApprovalIds: readonly string[],
    abortSignal: AbortSignal,
  ): Promise<Map<string, boolean>> {
    if (abortSignal.aborted) {
      const reason =
        abortSignal.reason instanceof Error
          ? abortSignal.reason
          : new Error("Approval wait aborted");
      return Promise.reject(reason);
    }

    const existing = this.waiters.get(assistantMessageId);
    if (existing) {
      this.waiters.delete(assistantMessageId);
      existing.cleanup();
      existing.reject(new Error("Superseded by new approval wait"));
    }

    return new Promise<Map<string, boolean>>((resolve, reject) => {
      const onAbort = () => {
        this.waiters.delete(assistantMessageId);
        const reason =
          abortSignal.reason instanceof Error
            ? abortSignal.reason
            : new Error("Approval wait aborted");
        reject(reason);
      };

      const cleanup = () => {
        abortSignal.removeEventListener("abort", onAbort);
      };

      abortSignal.addEventListener("abort", onAbort, { once: true });

      this.waiters.set(assistantMessageId, {
        expectedApprovalIds,
        resolve,
        reject,
        cleanup,
      });
    });
  }

  /**
   * Resolves an active in-memory approval waiter for `assistantMessageId`.
   *
   * @returns `true` if a matching waiter existed with all expected decisions and
   * was resolved; `false` otherwise so the caller can dispatch an Inngest event.
   */
  resolve(
    assistantMessageId: string,
    decisions: readonly ApprovalDecision[],
  ): boolean {
    const waiter = this.waiters.get(assistantMessageId);
    if (!waiter) {
      return false;
    }

    const decisionMap = new Map<string, boolean>();
    for (const decision of decisions) {
      decisionMap.set(decision.approvalId, decision.approved);
    }

    for (const expectedId of waiter.expectedApprovalIds) {
      if (!decisionMap.has(expectedId)) {
        return false;
      }
    }

    this.waiters.delete(assistantMessageId);
    waiter.cleanup();
    waiter.resolve(decisionMap);
    return true;
  }

  /**
   * Cancels and rejects an active approval waiter on stream stop or failure.
   */
  cancel(assistantMessageId: string): void {
    const waiter = this.waiters.get(assistantMessageId);
    if (!waiter) {
      return;
    }

    this.waiters.delete(assistantMessageId);
    waiter.cleanup();
    waiter.reject(new Error("Approval cancelled"));
  }

  /**
   * Checks whether an approval waiter is currently registered for `assistantMessageId`.
   */
  has(assistantMessageId: string): boolean {
    return this.waiters.has(assistantMessageId);
  }
}

export const chatApprovalRegistry = new ChatApprovalRegistry();
