import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useApprovalRound } from "@/hooks/chat/use-approval-round";
import type { PendingApproval } from "@/types/tool/approval";

function makeApproval(
  id: string,
  toolName = "create_skill",
): PendingApproval {
  return {
    approvalId: id,
    toolCallId: `call-${id}`,
    toolName,
    args: { name: id },
    signature: `sig-${id}`,
  };
}

describe("useApprovalRound", () => {
  it("returns empty state when pendingApprovals is empty", () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() => useApprovalRound([], onSubmit));

    expect(result.current.totalCount).toBe(0);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentApproval).toBeUndefined();
    expect(result.current.decidedCount).toBe(0);
    expect(result.current.canGoBack).toBe(false);

    act(() => {
      result.current.decideCurrent(true);
      result.current.decideAll(true);
      result.current.goBack();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("steps through 1 of N to N of N and submits in strict emission order", () => {
    const onSubmit = vi.fn();
    const approvals = [
      makeApproval("a1", "create_skill"),
      makeApproval("a2", "write_skill_file"),
      makeApproval("a3", "delete_skill_file"),
    ];

    const { result } = renderHook(() => useApprovalRound(approvals, onSubmit));

    expect(result.current.totalCount).toBe(3);
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.currentApproval?.approvalId).toBe("a1");
    expect(result.current.canGoBack).toBe(false);

    act(() => {
      result.current.decideCurrent(true);
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.currentIndex).toBe(1);
    expect(result.current.currentApproval?.approvalId).toBe("a2");
    expect(result.current.decidedCount).toBe(1);
    expect(result.current.canGoBack).toBe(true);

    // Go back and change decision for a1
    act(() => {
      result.current.goBack();
    });
    expect(result.current.currentIndex).toBe(0);
    expect(result.current.decidedCount).toBe(0);
    expect(result.current.canGoBack).toBe(false);

    act(() => {
      result.current.decideCurrent(false);
    });
    act(() => {
      result.current.decideCurrent(true);
    });
    expect(result.current.currentIndex).toBe(2);

    // Final decision submits all 3 in emission order
    act(() => {
      result.current.decideCurrent(false);
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "a1", approved: false },
      { approvalId: "a2", approved: true },
      { approvalId: "a3", approved: false },
    ]);

    // Subsequent calls after submission are ignored
    act(() => {
      result.current.goBack();
      result.current.decideCurrent(true);
      result.current.decideAll(true);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("supports decideAll(true) and decideAll(false)", () => {
    const onSubmit = vi.fn();
    const approvals = [makeApproval("a1"), makeApproval("a2")];

    const { result, rerender } = renderHook(
      ({ items, disabled }: { items: PendingApproval[]; disabled: boolean }) =>
        useApprovalRound(items, onSubmit, disabled),
      { initialProps: { items: approvals, disabled: false } },
    );

    act(() => {
      result.current.decideAll(true);
    });

    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "a1", approved: true },
      { approvalId: "a2", approved: true },
    ]);

    // New round resets state
    const nextRound = [makeApproval("b1"), makeApproval("b2")];
    rerender({ items: nextRound, disabled: false });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.decidedCount).toBe(0);

    act(() => {
      result.current.decideAll(false);
    });

    expect(onSubmit).toHaveBeenLastCalledWith([
      { approvalId: "b1", approved: false },
      { approvalId: "b2", approved: false },
    ]);
  });

  it("ignores actions when disabled", () => {
    const onSubmit = vi.fn();
    const approvals = [makeApproval("a1"), makeApproval("a2")];

    const { result } = renderHook(() =>
      useApprovalRound(approvals, onSubmit, true),
    );

    act(() => {
      result.current.decideCurrent(true);
      result.current.decideAll(true);
    });

    expect(result.current.currentIndex).toBe(0);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
