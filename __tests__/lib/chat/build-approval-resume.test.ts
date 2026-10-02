import { describe, expect, it } from "vitest";
import { buildApprovalResumeMessages } from "@/lib/chat/build-approval-resume";
import type { PendingApproval } from "@/types/tool/approval";

const pending: PendingApproval[] = [
  {
    approvalId: "aitxt-a",
    toolCallId: "call_A",
    toolName: "delete_skill_file",
    args: { path: "notes.md" },
    reason: "Writes to disk",
    signature: "sig-a",
  },
  {
    approvalId: "aitxt-b",
    toolCallId: "call_B",
    toolName: "mcp_send_email",
    serverName: "mail",
    args: { to: "a@b.c" },
    signature: "sig-b",
  },
];

describe("buildApprovalResumeMessages", () => {
  it("returns nothing when there is nothing pending", () => {
    expect(buildApprovalResumeMessages([], [])).toEqual([]);
  });

  it("puts the tool call and the approval request in the assistant message", () => {
    const [assistant] = buildApprovalResumeMessages(pending, [
      { approvalId: "aitxt-a", approved: true },
      { approvalId: "aitxt-b", approved: true },
    ]);
    expect(assistant.role).toBe("assistant");
    expect(assistant.content).toEqual([
      {
        type: "tool-call",
        toolCallId: "call_A",
        toolName: "delete_skill_file",
        input: { path: "notes.md" },
      },
      {
        type: "tool-approval-request",
        approvalId: "aitxt-a",
        toolCallId: "call_A",
        reason: "Writes to disk",
        signature: "sig-a",
      },
      {
        type: "tool-call",
        toolCallId: "call_B",
        toolName: "mcp_send_email",
        input: { to: "a@b.c" },
      },
      {
        type: "tool-approval-request",
        approvalId: "aitxt-b",
        toolCallId: "call_B",
        reason: undefined,
        signature: "sig-b",
      },
    ]);
  });

  it("uses a flat toolCallId, never a nested toolCall (V4)", () => {
    const [assistant] = buildApprovalResumeMessages([pending[0]], [
      { approvalId: "aitxt-a", approved: true },
    ]);
    const request = (assistant.content as any[])[1];
    expect(request.toolCallId).toBe("call_A");
    expect(request.toolCall).toBeUndefined();
  });

  it("keeps the tool input as an object, never a JSON string (V5)", () => {
    const [assistant] = buildApprovalResumeMessages([pending[0]], [
      { approvalId: "aitxt-a", approved: true },
    ]);
    expect(typeof (assistant.content as any[])[0].input).toBe("object");
  });

  it("carries the signature on the request part (V10)", () => {
    const [assistant] = buildApprovalResumeMessages([pending[0]], [
      { approvalId: "aitxt-a", approved: true },
    ]);
    const [request] = (assistant.content as any[]).filter(
      (p) => p.type === "tool-approval-request",
    );
    expect(request.signature).toBe("sig-a");
  });

  it("emits one response per decision in the tool message", () => {
    const [, tool] = buildApprovalResumeMessages(pending, [
      { approvalId: "aitxt-b", approved: false },
      { approvalId: "aitxt-a", approved: true },
    ]);
    expect(tool.role).toBe("tool");
    expect(tool.content).toEqual([
      { type: "tool-approval-response", approvalId: "aitxt-b", approved: false },
      {
        type: "tool-approval-response",
        approvalId: "aitxt-a",
        approved: true,
      },
    ]);
  });

  it("preserves out-of-order decisions (V8)", () => {
    const [, tool] = buildApprovalResumeMessages(pending, [
      { approvalId: "aitxt-b", approved: true },
      { approvalId: "aitxt-a", approved: true },
    ]);
    expect((tool.content as any[]).map((p) => p.approvalId)).toEqual([
      "aitxt-b",
      "aitxt-a",
    ]);
  });

  it("returns an empty array when nothing is pending, whatever the decisions", () => {
    expect(
      buildApprovalResumeMessages([], [
        { approvalId: "aitxt-a", approved: true },
      ]),
    ).toEqual([]);
  });

  it("refuses to build a half-answered round (V7)", () => {
    // A partial answer is what makes the SDK throw MissingToolResultsError and
    // destroy the turn. The action already blocks this, but the builder refuses
    // too, so a future caller cannot reintroduce the failure.
    expect(() =>
      buildApprovalResumeMessages(pending, [
        { approvalId: "aitxt-a", approved: true },
      ]),
    ).toThrow(/all/i);
  });

  it("ignores an unknown id but still requires every real one", () => {
    expect(() =>
      buildApprovalResumeMessages(pending, [
        { approvalId: "aitxt-a", approved: true },
        { approvalId: "aitxt-b", approved: false },
        { approvalId: "forged", approved: true },
      ]),
    ).not.toThrow();
  });

  it("treats a missing reason as absent rather than empty", () => {
    const [assistant] = buildApprovalResumeMessages([pending[1]], [
      { approvalId: "aitxt-b", approved: true },
    ]);
    expect((assistant.content as any[])[1].reason).toBeUndefined();
  });

  it("fails closed when a decision omits the approved flag", () => {
    const [, tool] = buildApprovalResumeMessages(
      [pending[0]],
      [{ approvalId: "aitxt-a" } as never],
    );
    expect(tool.content).toEqual([
      { type: "tool-approval-response", approvalId: "aitxt-a", approved: false },
    ]);
  });
});