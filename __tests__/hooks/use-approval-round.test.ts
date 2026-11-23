import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockToastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({
  toast: { error: mockToastError },
}));

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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("blocks duplicate submission while pending, resets isSubmitted on rejection or false return, and allows retry", async () => {
    let rejectFirst!: (err: unknown) => void;
    const onSubmit = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirst = reject;
          }),
      )
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce("string failure")
      .mockResolvedValueOnce(true);

    const approvals = [makeApproval("a1"), makeApproval("a2")];
    const { result } = renderHook(() => useApprovalRound(approvals, onSubmit));

    // Step to second item and trigger submission
    act(() => {
      result.current.decideCurrent(true);
    });

    let p1!: Promise<void>;
    act(() => {
      p1 = result.current.decideCurrent(false) as unknown as Promise<void>;
    });

    // While pending, duplicate decideCurrent / decideAll must be ignored
    act(() => {
      result.current.decideCurrent(true);
      result.current.decideAll(true);
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Reject with Error -> resets isSubmitted and shows toast
    await act(async () => {
      rejectFirst(new Error("Network dropped"));
      await p1;
    });
    expect(mockToastError).toHaveBeenCalledWith("Network dropped");

    // Retry with decideCurrent returning false -> resets isSubmitted for another retry
    await act(async () => {
      await result.current.decideCurrent(true);
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);

    // Retry with decideAll rejecting with non-Error -> shows fallback toast and resets
    await act(async () => {
      await result.current.decideAll(true);
    });
    expect(onSubmit).toHaveBeenCalledTimes(3);
    expect(mockToastError).toHaveBeenLastCalledWith(
      "Failed to submit tool approval",
    );

    // Final retry succeeds -> stays submitted
    await act(async () => {
      await result.current.decideAll(true);
    });
    expect(onSubmit).toHaveBeenCalledTimes(4);

    await act(async () => {
      await result.current.decideAll(false);
    });
    expect(onSubmit).toHaveBeenCalledTimes(4);
  });

  it("does not clear isSubmitted on a newer round when an earlier round fails late", async () => {
    let resolveOld!: (val: boolean) => void;
    let rejectOld2!: (err: unknown) => void;
    const onSubmit = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((r) => {
            resolveOld = r;
          }),
      )
      .mockResolvedValueOnce(true)
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((_, rej) => {
            rejectOld2 = rej;
          }),
      )
      .mockResolvedValueOnce(true);

    const { result, rerender } = renderHook(
      ({ items }: { items: PendingApproval[] }) =>
        useApprovalRound(items, onSubmit),
      { initialProps: { items: [makeApproval("old-1")] } },
    );

    let pOld!: Promise<void>;
    act(() => {
      pOld = result.current.decideCurrent(true) as unknown as Promise<void>;
    });

    // Switch to a new round and submit it before old settles
    rerender({ items: [makeApproval("new-1")] });
    await act(async () => {
      await result.current.decideCurrent(true);
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);

    // Old round settles as false -> must not unlock the already-submitted new round
    await act(async () => {
      resolveOld(false);
      await pOld;
    });
    await act(async () => {
      await result.current.decideCurrent(false);
    });
    expect(onSubmit).toHaveBeenCalledTimes(2);

    // Also verify late rejection from an older round does not unlock a newer submitted round
    rerender({ items: [makeApproval("old-2")] });
    let pOld2!: Promise<void>;
    act(() => {
      pOld2 = result.current.decideCurrent(true) as unknown as Promise<void>;
    });
    rerender({ items: [makeApproval("new-2")] });
    await act(async () => {
      await result.current.decideCurrent(true);
    });
    expect(onSubmit).toHaveBeenCalledTimes(4);

    await act(async () => {
      rejectOld2(new Error("late rejection"));
      await pOld2;
    });
    await act(async () => {
      await result.current.decideCurrent(false);
    });
    expect(onSubmit).toHaveBeenCalledTimes(4);
  });
});
