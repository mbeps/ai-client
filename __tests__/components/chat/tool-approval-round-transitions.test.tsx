import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolCallDisplay } from "@/components/chat/message/tool-call-display";
import type { PendingApproval } from "@/types/tool/approval";

/** Round 1: one call, which the user approves. */
const round1: PendingApproval[] = [
  {
    approvalId: "r1-read-cells",
    toolCallId: "call-read-cells",
    toolName: "read_cells",
    args: { range: "A1:B2" },
    signature: "s1",
  },
];

/**
 * Round 2: the model asks for a different call. `approvalId` is fresh every
 * time the SDK emits a request, while the call it answers may be the same one.
 */
const round2: PendingApproval[] = [
  {
    approvalId: "r2-sheet-summary",
    toolCallId: "call-sheet-summary",
    toolName: "get_sheet_summary",
    args: {},
    signature: "s2",
  },
];

function display(pendingApprovals: PendingApproval[], onApproveDecisions: any) {
  return (
    <ToolCallDisplay
      toolCalls={pendingApprovals.map((a) => ({
        toolCallId: a.toolCallId,
        toolName: a.toolName,
        args: a.args,
      }))}
      toolResults={[]}
      pendingApprovals={pendingApprovals}
      onApproveDecisions={onApproveDecisions}
      approvalsDisabled={false}
    />
  );
}

describe("approval verdicts across rounds", () => {
  it("lets a new round be decided after the previous round was answered", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(display(round1, onSubmit));

    await user.click(screen.getByRole("button", { name: /approve tool call/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Round 2 parks a new gate on the same mounted component. The stale verdict
    // from round 1 must not make this round read as already answered, or the
    // user is left with a dead "Approved" chip and no way to continue.
    rerender(display(round2, onSubmit));

    expect(
      screen.getByRole("button", { name: /approve tool call/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deny tool call/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /approve tool call/i }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    // Only the new round's decision is sent. A stale id would be filtered out
    // server side and leave the round half answered.
    expect(onSubmit.mock.calls[1][0]).toEqual([
      { approvalId: "r2-sheet-summary", approved: true },
    ]);
  });

  it("discards verdicts for calls that left the round", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(display(round1, onSubmit));

    await user.click(screen.getByRole("button", { name: /deny tool call/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // A round with two calls where one is new: the old verdict must not count
    // towards the new total, or the batch submits with a stale id and the
    // server rejects it as a partial answer.
    rerender(
      display(
        [
          ...round1.map((a) => ({ ...a, approvalId: "r3-read-cells" })),
          ...round2,
        ],
        onSubmit,
      ),
    );

    const approve = () =>
      screen.getAllByRole("button", { name: /approve tool call/i });
    expect(approve()).toHaveLength(2);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    await user.click(approve()[0]);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await user.click(approve()[0]);
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[1][0]).toEqual([
      { approvalId: "r3-read-cells", approved: true },
      { approvalId: "r2-sheet-summary", approved: true },
    ]);
  });

  it("keeps a verdict when the round grows by re-requesting the same call", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    // The stream publishes a cumulative list, so a round can gain a call while
    // the user is reading it. The verdicts already staged stay valid and the
    // new call joins them, because both calls are pending at the same time.
    const growing: PendingApproval[] = [
      { ...round1[0], approvalId: "r1-read-cells" },
      round2[0],
    ];
    const { rerender } = render(display(growing, onSubmit));

    const approve = () =>
      screen.getAllByRole("button", { name: /approve tool call/i });
    expect(approve()).toHaveLength(2);

    await user.click(approve()[0]);
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(approve()[0]);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual([
      { approvalId: "r1-read-cells", approved: true },
      { approvalId: "r2-sheet-summary", approved: true },
    ]);

    rerender(display(growing, onSubmit));
    expect(
      screen.getAllByRole("button", { name: /undo decision/i }),
    ).toHaveLength(2);
  });
});