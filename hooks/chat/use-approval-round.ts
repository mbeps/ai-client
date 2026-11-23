"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ApprovalDecision, PendingApproval } from "@/types/tool/approval";

/**
 * Manages sequential one-at-a-time approval decisions for a round of pending
 * tool calls. Stages each verdict locally until the final call in the round is
 * decided, then submits all decisions together in strict emission order.
 *
 * @param pendingApprovals - Ordered list of blocked tool calls for the current round.
 * @param onSubmit - Callback invoked with the complete, ordered decision list.
 * @param disabled - Disables interaction while a submission is in flight.
 * @returns Active step index, current approval item, and decision handlers.
 */
export function useApprovalRound(
  pendingApprovals: readonly PendingApproval[],
  onSubmit: (
    decisions: ApprovalDecision[],
  ) => void | boolean | Promise<void> | Promise<boolean>,
  disabled = false,
) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const roundKey = pendingApprovals.map((a) => a.approvalId).join(" ");
  const roundKeyRef = useRef(roundKey);
  roundKeyRef.current = roundKey;

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset staged decisions whenever round identity changes
  useEffect(() => {
    setCurrentIndex(0);
    setDecisions({});
    setIsSubmitted(false);
  }, [roundKey]);

  const totalCount = pendingApprovals.length;
  const currentApproval = pendingApprovals[currentIndex];
  const decidedCount = Object.keys(decisions).length;
  const canGoBack = currentIndex > 0 && !isSubmitted && !disabled;

  const submitOrderedDecisions = useCallback(
    async (ordered: ApprovalDecision[]) => {
      const submittedRoundKey = roundKeyRef.current;
      setIsSubmitted(true);
      try {
        const result = await onSubmit(ordered);
        if (result === false && roundKeyRef.current === submittedRoundKey) {
          setIsSubmitted(false);
        }
      } catch (error) {
        if (roundKeyRef.current === submittedRoundKey) {
          setIsSubmitted(false);
        }
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to submit tool approval",
        );
      }
    },
    [onSubmit],
  );

  const decideCurrent = useCallback(
    async (approved: boolean) => {
      if (disabled || isSubmitted || !currentApproval) return;

      const nextDecisions = {
        ...decisions,
        [currentApproval.approvalId]: approved,
      };
      setDecisions(nextDecisions);

      if (currentIndex + 1 >= totalCount) {
        const ordered = pendingApprovals.map((item) => ({
          approvalId: item.approvalId,
          approved: Boolean(nextDecisions[item.approvalId]),
        }));
        await submitOrderedDecisions(ordered);
        return;
      }

      setCurrentIndex(currentIndex + 1);
    },
    [
      currentApproval,
      currentIndex,
      decisions,
      disabled,
      isSubmitted,
      pendingApprovals,
      submitOrderedDecisions,
      totalCount,
    ],
  );

  const decideAll = useCallback(
    async (approved: boolean) => {
      if (disabled || isSubmitted || totalCount === 0) return;

      const nextDecisions: Record<string, boolean> = {};
      for (const item of pendingApprovals) {
        nextDecisions[item.approvalId] = approved;
      }
      setDecisions(nextDecisions);
      setCurrentIndex(totalCount - 1);
      await submitOrderedDecisions(
        pendingApprovals.map((item) => ({
          approvalId: item.approvalId,
          approved,
        })),
      );
    },
    [
      disabled,
      isSubmitted,
      pendingApprovals,
      submitOrderedDecisions,
      totalCount,
    ],
  );

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    const prevIndex = currentIndex - 1;
    const prevApproval = pendingApprovals[prevIndex];
    setDecisions((prev) => {
      const { [prevApproval.approvalId]: _, ...rest } = prev;
      return rest;
    });
    setCurrentIndex(prevIndex);
  }, [canGoBack, currentIndex, pendingApprovals]);

  return {
    currentIndex,
    currentApproval,
    totalCount,
    decidedCount,
    canGoBack,
    decideCurrent,
    decideAll,
    goBack,
  };
}
