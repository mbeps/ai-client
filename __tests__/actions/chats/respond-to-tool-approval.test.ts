import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.hoisted(() => vi.fn());
const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());
const mockCanResolveRegistry = vi.hoisted(() => vi.fn());
const mockResolveRegistry = vi.hoisted(() => vi.fn());
const mockInngestSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: mockSelectLimit,
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mockUpdateWhere,
      })),
    })),
  },
}));

vi.mock("@/lib/chat/chat-approval-registry", () => ({
  chatApprovalRegistry: {
    canResolve: mockCanResolveRegistry,
    resolve: mockResolveRegistry,
  },
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: mockInngestSend,
  },
}));

import { respondToToolApproval } from "@/actions/chats/respond-to-tool-approval";
import { ERROR_CODE } from "@/lib/error/error-code";

const VALID_MSG_ID = "00000000-0000-4000-8000-000000000001";
const VALID_CHAT_ID = "00000000-0000-4000-8000-000000000002";
const VALID_USER_MSG_ID = "00000000-0000-4000-8000-000000000003";

const SESSION = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
  },
};

function makeMetadata(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    parentUserMessageId: VALID_USER_MSG_ID,
    approvalRound: 1,
    pendingApprovals: [
      {
        approvalId: "app-1",
        toolCallId: "call-1",
        toolName: "create_skill",
        args: { name: "x" },
        signature: "sig-1",
      },
      {
        approvalId: "app-2",
        toolCallId: "call-2",
        toolName: "write_skill_file",
        args: { path: "SKILL.md" },
        signature: "sig-2",
      },
    ],
    ...overrides,
  });
}

describe("respondToToolApproval action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue(SESSION);
    mockUpdateWhere.mockResolvedValue(undefined);
    mockInngestSend.mockResolvedValue({ ids: ["evt-1"] });
    mockCanResolveRegistry.mockReturnValue(false);
    mockResolveRegistry.mockReturnValue(false);
  });

  it("propagates UNAUTHORIZED when requireSession rejects", async () => {
    mockRequireSession.mockRejectedValueOnce(new Error("Unauthorized"));
    const res = await respondToToolApproval({
      assistantMessageId: VALID_MSG_ID,
      decisions: [{ approvalId: "app-1", approved: true }],
    });
    expect(res.ok).toBe(false);
  });

  it("returns INVALID_INPUT on malformed payload", async () => {
    const res = await respondToToolApproval({
      assistantMessageId: "not-a-uuid",
      decisions: [],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
    }
  });

  it("returns NOT_FOUND when message does not exist or is not owned by user", async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    const res = await respondToToolApproval({
      assistantMessageId: VALID_MSG_ID,
      decisions: [{ approvalId: "app-1", approved: true }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.NOT_FOUND);
    }
  });

  it("returns NOT_FOUND when target message is not an assistant message", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        messageId: VALID_MSG_ID,
        chatId: VALID_CHAT_ID,
        role: "user",
        metadata: null,
      },
    ]);
    const res = await respondToToolApproval({
      assistantMessageId: VALID_MSG_ID,
      decisions: [{ approvalId: "app-1", approved: true }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.NOT_FOUND);
    }
  });

  it("returns ok({ success: true }) idempotently when pendingApprovals is empty", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        messageId: VALID_MSG_ID,
        chatId: VALID_CHAT_ID,
        role: "assistant",
        metadata: makeMetadata({ pendingApprovals: [] }),
      },
    ]);

    const res = await respondToToolApproval({
      assistantMessageId: VALID_MSG_ID,
      decisions: [{ approvalId: "app-1", approved: true }],
    });

    expect(res).toEqual({ ok: true, value: { success: true } });
    expect(mockResolveRegistry).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("rejects partial decisions with INVALID_INPUT", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        messageId: VALID_MSG_ID,
        chatId: VALID_CHAT_ID,
        role: "assistant",
        metadata: makeMetadata(),
      },
    ]);

    const res = await respondToToolApproval({
      assistantMessageId: VALID_MSG_ID,
      decisions: [{ approvalId: "app-1", approved: true }],
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe(ERROR_CODE.INVALID_INPUT);
      expect(res.error.message).toBe(
        "All pending tool calls must be answered together",
      );
    }
  });

  it("clears pendingApprovals in DB before resolving in-memory chatApprovalRegistry waiter", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        messageId: VALID_MSG_ID,
        chatId: VALID_CHAT_ID,
        role: "assistant",
        metadata: makeMetadata({ model: "gpt-4o" }),
      },
    ]);
    mockCanResolveRegistry.mockReturnValueOnce(true);
    mockResolveRegistry.mockReturnValueOnce(true);

    // Submitted in reverse order; action must order strictly by pendingApprovals
    const res = await respondToToolApproval({
      assistantMessageId: VALID_MSG_ID,
      decisions: [
        { approvalId: "app-2", approved: false },
        { approvalId: "app-1", approved: true },
      ],
    });

    expect(res).toEqual({ ok: true, value: { success: true } });
    expect(mockUpdateWhere).toHaveBeenCalledOnce();
    expect(mockResolveRegistry).toHaveBeenCalledWith(VALID_MSG_ID, [
      { approvalId: "app-1", approved: true },
      { approvalId: "app-2", approved: false },
    ]);
    expect(mockUpdateWhere.mock.invocationCallOrder[0]).toBeLessThan(
      mockResolveRegistry.mock.invocationCallOrder[0],
    );
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("does not resolve the in-memory waiter if clearing pendingApprovals in DB fails", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        messageId: VALID_MSG_ID,
        chatId: VALID_CHAT_ID,
        role: "assistant",
        metadata: makeMetadata({ model: "gpt-4o" }),
      },
    ]);
    mockCanResolveRegistry.mockReturnValueOnce(true);
    mockUpdateWhere.mockRejectedValueOnce(new Error("DB write failed"));

    const res = await respondToToolApproval({
      assistantMessageId: VALID_MSG_ID,
      decisions: [
        { approvalId: "app-1", approved: true },
        { approvalId: "app-2", approved: false },
      ],
    });

    expect(res.ok).toBe(false);
    expect(mockResolveRegistry).not.toHaveBeenCalled();
    expect(mockInngestSend).not.toHaveBeenCalled();
  });

  it("dispatches chat/approval.respond to Inngest when no in-memory waiter exists", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        messageId: VALID_MSG_ID,
        chatId: VALID_CHAT_ID,
        role: "assistant",
        metadata: makeMetadata(),
      },
    ]);
    mockResolveRegistry.mockReturnValueOnce(false);

    const res = await respondToToolApproval({
      assistantMessageId: VALID_MSG_ID,
      decisions: [
        { approvalId: "app-2", approved: false },
        { approvalId: "app-1", approved: true },
      ],
    });

    expect(res).toEqual({ ok: true, value: { success: true } });
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: "chat/approval.respond",
      data: {
        chatId: VALID_CHAT_ID,
        userId: "user-1",
        userName: "Test User",
        userEmail: "test@example.com",
        assistantMessageId: VALID_MSG_ID,
        userMessageId: VALID_USER_MSG_ID,
        decisions: [
          { approvalId: "app-1", approved: true },
          { approvalId: "app-2", approved: false },
        ],
      },
    });
  });

  it("handles null parentUserMessageId when dispatching chat/approval.respond", async () => {
    mockSelectLimit.mockResolvedValueOnce([
      {
        messageId: VALID_MSG_ID,
        chatId: VALID_CHAT_ID,
        role: "assistant",
        metadata: makeMetadata({ parentUserMessageId: undefined }),
      },
    ]);
    mockResolveRegistry.mockReturnValueOnce(false);

    const res = await respondToToolApproval({
      assistantMessageId: VALID_MSG_ID,
      decisions: [
        { approvalId: "app-1", approved: true },
        { approvalId: "app-2", approved: true },
      ],
    });

    expect(res).toEqual({ ok: true, value: { success: true } });
    expect(mockInngestSend).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userMessageId: undefined,
        }),
      }),
    );
  });
});
