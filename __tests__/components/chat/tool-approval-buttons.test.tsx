import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToolCallDisplay } from "@/components/chat/message/tool-call-display";
import type { ApprovalDecision, PendingApproval } from "@/types/tool/approval";

const approvals: PendingApproval[] = [
  {
    approvalId: "a1",
    toolCallId: "c1",
    toolName: "delete_skill_file",
    args: {},
    signature: "s1",
  },
  {
    approvalId: "a2",
    toolCallId: "c2",
    toolName: "send_email",
    args: {},
    signature: "s2",
  },
];

/** Mirrors the real tree: the round owns the verdicts, the rows only render. */
function Harness({
  onSubmit,
  disabled = false,
  calls = approvals,
}: {
  onSubmit: (decisions: ApprovalDecision[]) => void;
  disabled?: boolean;
  calls?: PendingApproval[];
}) {
  return (
    <ToolCallDisplay
      toolCalls={calls.map((a) => ({
        toolCallId: a.toolCallId,
        toolName: a.toolName,
        args: a.args,
      }))}
      toolResults={[]}
      pendingApprovals={calls}
      onApproveDecisions={onSubmit}
      approvalsDisabled={disabled}
    />
  );
}

describe("ToolApprovalButtons via ToolCallDisplay", () => {
  it("renders one button pair per blocked call", () => {
    render(<Harness onSubmit={vi.fn()} />);
    expect(
      screen.getAllByRole("button", { name: /approve tool call/i }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: /deny tool call/i }),
    ).toHaveLength(2);
  });

  it("sends immediately when a single call is decided", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} calls={[approvals[0]]} />);
    await user.click(
      screen.getByRole("button", { name: /approve tool call/i }),
    );
    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "a1", approved: true },
    ]);
  });

  it("waits for every call before sending (V7)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(
      screen.getAllByRole("button", { name: /approve tool call/i })[1],
    );
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(
      screen.getAllByRole("button", { name: /deny tool call/i })[0],
    );
    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "a2", approved: true },
      { approvalId: "a1", approved: false },
    ]);
  });

  it("sends in the order the user decided, not the request order (V8)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(
      screen.getAllByRole("button", { name: /approve tool call/i })[1],
    );
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(
      screen.getAllByRole("button", { name: /approve tool call/i })[0],
    );
    expect(onSubmit.mock.calls[0][0]).toEqual([
      { approvalId: "a2", approved: true },
      { approvalId: "a1", approved: true },
    ]);
  });

  it("lets a decision be undone before the batch is sent", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(
      screen.getAllByRole("button", { name: /deny tool call/i })[0],
    );
    expect(onSubmit).not.toHaveBeenCalled();
    await user.click(
      screen.getAllByRole("button", { name: /undo decision/i })[0],
    );
    expect(
      screen.getAllByRole("button", { name: /deny tool call/i }),
    ).toHaveLength(2);
  });

  it("shows no counter text, only the buttons", () => {
    const { container } = render(<Harness onSubmit={vi.fn()} />);
    expect(container).not.toHaveTextContent(/need a decision/i);
    expect(
      screen.getAllByRole("button", { name: /approve tool call/i }),
    ).toHaveLength(2);
  });

  it("disables both buttons while disabled", () => {
    render(<Harness onSubmit={vi.fn()} disabled calls={[approvals[0]]} />);
    expect(
      screen.getByRole("button", { name: /approve tool call/i }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /deny tool call/i })).toBeDisabled();
  });

  it("keeps a call answered when another call is decided later", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(
      screen.getAllByRole("button", { name: /deny tool call/i })[0],
    );
    expect(screen.getByText("Denied")).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: /approve tool call/i })[0],
    );
    expect(onSubmit).toHaveBeenCalledWith([
      { approvalId: "a1", approved: false },
      { approvalId: "a2", approved: true },
    ]);
  });

  it("locks every row once the batch has been sent", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<Harness onSubmit={onSubmit} />);
    await user.click(
      screen.getAllByRole("button", { name: /approve tool call/i })[0],
    );
    await user.click(
      screen.getAllByRole("button", { name: /deny tool call/i })[0],
    );
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // The parent sets approvalsDisabled once the batch is in flight. No undo
    // may survive, or a stale verdict could be sent twice.
    rerender(<Harness onSubmit={onSubmit} disabled />);
    for (const button of screen.getAllByRole("button", {
      name: /undo decision/i,
    })) {
      expect(button).toBeDisabled();
    }
  });
});
