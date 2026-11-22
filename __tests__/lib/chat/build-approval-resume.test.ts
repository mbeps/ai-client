import { describe, expect, it } from "vitest";
import { buildApprovalResumeMessages } from "@/lib/chat/build-approval-resume";
import type { ApprovalDecision, PendingApproval } from "@/types/tool/approval";

const makePending = (
  overrides: Partial<PendingApproval> = {},
): PendingApproval => ({
  approvalId: "app-1",
  toolCallId: "call-1",
  toolName: "create_skill",
  args: { name: "test-skill" },
  signature: "sig-1",
  ...overrides,
});

describe("buildApprovalResumeMessages", () => {
  it("returns an empty array when pending is empty", () => {
    expect(buildApprovalResumeMessages([], [])).toEqual([]);
  });

  it("throws when any pending approval is missing from decisions", () => {
    const pending = [
      makePending({ approvalId: "app-1", toolCallId: "call-1" }),
      makePending({ approvalId: "app-2", toolCallId: "call-2" }),
    ];
    const decisions: ApprovalDecision[] = [
      { approvalId: "app-1", approved: true },
    ];

    expect(() => buildApprovalResumeMessages(pending, decisions)).toThrow(
      "Missing approval decision for app-2",
    );
  });

  it("builds assistant and tool messages with flat toolCallId and signature, strictly ordered by pending", () => {
    const pending = [
      makePending({
        approvalId: "app-1",
        toolCallId: "call-1",
        toolName: "create_skill",
        args: { name: "alpha" },
        reason: "Creates a skill",
        signature: "sig-1",
      }),
      makePending({
        approvalId: "app-2",
        toolCallId: "call-2",
        toolName: "write_skill_file",
        args: { path: "SKILL.md" },
        signature: "sig-2",
      }),
    ];

    // Out-of-order decisions array
    const decisions: ApprovalDecision[] = [
      { approvalId: "app-2", approved: false },
      { approvalId: "app-1", approved: true },
    ];

    const result = buildApprovalResumeMessages(pending, decisions);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "create_skill",
          input: { name: "alpha" },
        },
        {
          type: "tool-approval-request",
          approvalId: "app-1",
          toolCallId: "call-1",
          reason: "Creates a skill",
          signature: "sig-1",
        },
        {
          type: "tool-call",
          toolCallId: "call-2",
          toolName: "write_skill_file",
          input: { path: "SKILL.md" },
        },
        {
          type: "tool-approval-request",
          approvalId: "app-2",
          toolCallId: "call-2",
          signature: "sig-2",
        },
      ],
    });

    expect(result[1]).toEqual({
      role: "tool",
      content: [
        {
          type: "tool-approval-response",
          approvalId: "app-1",
          approved: true,
        },
        {
          type: "tool-approval-response",
          approvalId: "app-2",
          approved: false,
        },
      ],
    });
  });

  it("defaults undefined args to empty object on tool-call input", () => {
    const pending = [
      makePending({
        approvalId: "app-1",
        toolCallId: "call-1",
        args: undefined,
      }),
    ];
    const result = buildApprovalResumeMessages(pending, [
      { approvalId: "app-1", approved: true },
    ]);

    expect(result[0]).toEqual({
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "create_skill",
          input: {},
        },
        {
          type: "tool-approval-request",
          approvalId: "app-1",
          toolCallId: "call-1",
          signature: "sig-1",
        },
      ],
    });
  });
});
