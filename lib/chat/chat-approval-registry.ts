import type { ApprovalDecision } from "@/types/tool/approval";

interface ApprovalWaiter {
  expectedApprovalIds: readonly string[];
  resolve: (decisions: Map<string, boolean>) => void;
  reject: (reason: Error) => void;
  cleanup: () => void;
}

function toDecisionMap(
  decisions: readonly ApprovalDecision[],
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const decision of decisions) {
    map.set(decision.approvalId, decision.approved);
  }
  return map;
}

function matchesExpectedIds(
  expectedApprovalIds: readonly string[],
  decisionMap: ReadonlyMap<string, boolean>,
): boolean {
  return expectedApprovalIds.every((id) => decisionMap.has(id));
}

function hasSameApprovalIds(
  a: readonly string[],
  b: readonly string[],
): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * In-memory registry coordinating in-flight subagent tool approval pauses
 * within an active Inngest chat generation run.
 *
 * Mirrors `chatAbortRegistry`: allows `respondToToolApproval` to immediately
 * unblock a waiting subagent step without spawning a new Inngest resume event.
 * Supports multiple concurrent waiters per `assistantMessageId` keyed by their
 * expected `approvalId` batches.
 */
class ChatApprovalRegistry {
  private waiters = new Map<string, Set<ApprovalWaiter>>();

  private removeWaiter(
    assistantMessageId: string,
    set: Set<ApprovalWaiter>,
    waiter: ApprovalWaiter,
  ): void {
    set.delete(waiter);
    if (set.size === 0) {
      this.waiters.delete(assistantMessageId);
    }
  }

  /**
   * Registers a waiter for `assistantMessageId` and resolves once all
   * `expectedApprovalIds` are answered via `resolve()`.
   *
   * Concurrent waits for the same `assistantMessageId` coexist without
   * superseding one another. Rejects immediately if `abortSignal` is already
   * aborted or aborts while waiting.
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

    return new Promise<Map<string, boolean>>((resolve, reject) => {
      let waiter!: ApprovalWaiter;
      let set = this.waiters.get(assistantMessageId);
      if (!set) {
        set = new Set();
        this.waiters.set(assistantMessageId, set);
      }

      const onAbort = () => {
        this.removeWaiter(assistantMessageId, set, waiter);
        const reason =
          abortSignal.reason instanceof Error
            ? abortSignal.reason
            : new Error("Approval wait aborted");
        reject(reason);
      };

      const cleanup = () => {
        abortSignal.removeEventListener("abort", onAbort);
      };

      waiter = {
        expectedApprovalIds,
        resolve,
        reject,
        cleanup,
      };

      abortSignal.addEventListener("abort", onAbort, { once: true });
      set.add(waiter);
    });
  }

  /**
   * Checks whether at least one registered waiter for `assistantMessageId`
   * matches all decisions in `decisions`.
   */
  canResolve(
    assistantMessageId: string,
    decisions: readonly ApprovalDecision[],
  ): boolean {
    const set = this.waiters.get(assistantMessageId);
    if (!set || set.size === 0) {
      return false;
    }

    const decisionMap = toDecisionMap(decisions);
    for (const waiter of set) {
      if (matchesExpectedIds(waiter.expectedApprovalIds, decisionMap)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Resolves all active in-memory approval waiters for `assistantMessageId`
   * whose expected approval IDs are satisfied by `decisions`.
   *
   * @returns `true` if at least one matching waiter existed and was resolved;
   * `false` otherwise so the caller can dispatch an Inngest event.
   */
  resolve(
    assistantMessageId: string,
    decisions: readonly ApprovalDecision[],
  ): boolean {
    const set = this.waiters.get(assistantMessageId);
    if (!set || set.size === 0) {
      return false;
    }

    const decisionMap = toDecisionMap(decisions);
    const matched: ApprovalWaiter[] = [];
    for (const waiter of set) {
      if (matchesExpectedIds(waiter.expectedApprovalIds, decisionMap)) {
        matched.push(waiter);
      }
    }

    if (matched.length === 0) {
      return false;
    }

    for (const waiter of matched) {
      this.removeWaiter(assistantMessageId, set, waiter);
      waiter.cleanup();
      waiter.resolve(decisionMap);
    }
    return true;
  }

  /**
   * Cancels and rejects a specific batch waiter for `assistantMessageId`
   * (e.g. when persistence or realtime emission fails after pre-registration).
   */
  cancelBatch(
    assistantMessageId: string,
    expectedApprovalIds: readonly string[],
  ): void {
    const set = this.waiters.get(assistantMessageId);
    if (!set) return;

    for (const waiter of set) {
      if (hasSameApprovalIds(waiter.expectedApprovalIds, expectedApprovalIds)) {
        this.removeWaiter(assistantMessageId, set, waiter);
        waiter.cleanup();
        waiter.reject(new Error("Approval cancelled"));
        break;
      }
    }
  }

  /**
   * Cancels and rejects all active approval waiters on stream stop or failure.
   */
  cancel(assistantMessageId: string): void {
    const set = this.waiters.get(assistantMessageId);
    if (!set) {
      return;
    }

    const waiters = [...set];
    this.waiters.delete(assistantMessageId);
    for (const waiter of waiters) {
      waiter.cleanup();
      waiter.reject(new Error("Approval cancelled"));
    }
  }

  /**
   * Checks whether any approval waiter is currently registered for `assistantMessageId`.
   */
  has(assistantMessageId: string): boolean {
    const set = this.waiters.get(assistantMessageId);
    return Boolean(set && set.size > 0);
  }
}

export const chatApprovalRegistry = new ChatApprovalRegistry();
