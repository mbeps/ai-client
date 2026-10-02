import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolCallDisplay } from "@/components/chat/message/tool-call-display";
import type { PendingApproval } from "@/types/tool/approval";

const approvals: PendingApproval[] = [
  {
    approvalId: "a1",
    toolCallId: "c1",
    toolName: "read_cells",
    args: { range: "A1:B2" },
    signature: "s1",
  },
  {
    approvalId: "a2",
    toolCallId: "c2",
    toolName: "read_cells",
    args: { range: "C1:D2" },
    signature: "s2",
  },
  {
    approvalId: "a3",
    toolCallId: "c3",
    toolName: "sheet_management",
    args: { op: "add" },
    signature: "s3",
  },
];

const toolCalls = approvals.map((a) => ({
  toolCallId: a.toolCallId,
  toolName: a.toolName,
  args: a.args,
}));

describe("ToolCallDisplay approval rows", () => {
  it("renders one button pair per pending tool call, on that call's row", () => {
    render(
      <ToolCallDisplay
        toolCalls={toolCalls}
        toolResults={[]}
        pendingApprovals={approvals}
        onApproveDecisions={vi.fn()}
      />,
    );

    // Every blocked call gets its own row, and no row carries another
    // call's buttons. A shared strip loses the link between a decision and
    // the tool it answers, which is the whole point of showing them per row.
    const rows = screen.getAllByTestId("tool-approval-row");
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.querySelectorAll("button")).toHaveLength(2);
    }
    expect(
      screen.getAllByRole("button", { name: /approve tool call/i }),
    ).toHaveLength(3);
    expect(
      screen.getAllByRole("button", { name: /deny tool call/i }),
    ).toHaveLength(3);
  });

  it("keeps a decided call's row clickable until the batch is sent (V7)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ToolCallDisplay
        toolCalls={toolCalls}
        toolResults={[]}
        pendingApprovals={approvals}
        onApproveDecisions={onSubmit}
      />,
    );

    const approve = () =>
      screen.getAllByRole("button", { name: /approve tool call/i });

    // Three calls. One decision must not submit, and must not lock the rest.
    expect(approve()).toHaveLength(3);
    await user.click(approve()[1]);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(approve()).toHaveLength(2);

    // Retracting a verdict puts its own row back to undecided and leaves the
    // other decided call alone, so all three are open again.
    await user.click(screen.getAllByRole("button", { name: /undo decision/i })[0]);
    expect(approve()).toHaveLength(3);

    // The batch only goes out once every call has a verdict.
    await user.click(approve()[0]);
    await user.click(approve()[0]);
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(approve()[0]);
    // Verdicts are emitted in the order the user decided them, which is the
    // order the rows appear in once the retracted row was reopened.
    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "a1", approved: true },
      { approvalId: "a2", approved: true },
      { approvalId: "a3", approved: true },
    ]);
  });
  it("shows an icon on both the approve and deny buttons", () => {
    render(
      <ToolCallDisplay
        toolCalls={[toolCalls[0]]}
        toolResults={[]}
        pendingApprovals={[approvals[0]]}
        onApproveDecisions={vi.fn()}
      />,
    );
    // An unlabelled Deny reads as an afterthought next to a glyphed Approve.
    const deny = screen.getByRole("button", { name: /deny tool call/i });
    const approve = screen.getByRole("button", { name: /approve tool call/i });
    expect(deny.querySelector("svg")).not.toBeNull();
    expect(approve.querySelector("svg")).not.toBeNull();
  });

  it("renders a row for a pending call that has no toolCalls entry", () => {
    // A parked round persists the blocked call under pendingApprovals only.
    render(
      <ToolCallDisplay
        toolCalls={[]}
        toolResults={[]}
        pendingApprovals={[approvals[0]]}
        onApproveDecisions={vi.fn()}
      />,
    );
    expect(screen.getAllByTestId("tool-approval-row")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /approve tool call/i }),
    ).toBeInTheDocument();
  });

  it("renders no approval row for a call that is not blocked", () => {
    render(
      <ToolCallDisplay
        toolCalls={[toolCalls[0]]}
        toolResults={[
          { toolCallId: "c1", toolName: "read_cells", result: "ok" },
        ]}
        pendingApprovals={[]}
        onApproveDecisions={vi.fn()}
      />,
    );
    expect(screen.queryAllByTestId("tool-approval-row")).toHaveLength(0);
  });
});
