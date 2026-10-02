import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSessionMock,
  selectWhere,
  inngestSend,
  parseMetadataMock,
} = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  selectWhere: vi.fn(),
  inngestSend: vi.fn(),
  parseMetadataMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: requireSessionMock,
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({ where: selectWhere }),
        where: selectWhere,
      }),
    }),
  },
}));

vi.mock("@/drizzle/schema", () => ({
  chat: { id: "id", userId: "userId" },
  message: { id: "id", chatId: "chatId", metadata: "metadata" },
}));

vi.mock("@/lib/inngest/client", () => ({ inngest: { send: inngestSend } }));

vi.mock("@/lib/chat/parse-message-metadata", () => ({
  parseMessageMetadata: parseMetadataMock,
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (...a: unknown[]) => ({ eq: a }),
}));

const mockLog = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => mockLog),
  logger: mockLog,
}));

import { respondToToolApproval } from "@/actions/chats/respond-to-tool-approval";

const MESSAGE_ID = "33333333-3333-4333-8333-333333333333";

const pending = [
  {
    approvalId: "aitxt-a",
    toolCallId: "cA",
    toolName: "delete_skill_file",
    args: { p: 1 },
    signature: "sigA",
  },
  {
    approvalId: "aitxt-b",
    toolCallId: "cB",
    toolName: "send_email",
    args: { to: "x" },
    signature: "sigB",
  },
];

/** The row is only ever reached through the mocked `.where()` tail. */
function stubRow(metadata: unknown) {
  selectWhere.mockResolvedValue([
    {
      id: MESSAGE_ID,
      chatId: "chat1",
      metadata: JSON.stringify(metadata),
    },
  ]);
}

describe("respondToToolApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
      },
    });
    inngestSend.mockResolvedValue({ ids: ["e1"] });
    parseMetadataMock.mockReturnValue({
      pendingApprovals: pending,
      approvalRound: 0,
      parentUserMessageId: "user-msg-1",
    });
  });

  it("forwards only the decisions, never the tool name, args, or signature", async () => {
    stubRow({ pendingApprovals: pending });

    await respondToToolApproval({
      assistantMessageId: MESSAGE_ID,
      decisions: [
        { approvalId: "aitxt-a", approved: true },
        { approvalId: "aitxt-b", approved: false },
      ],
    });

    expect(inngestSend).toHaveBeenCalledWith({
      name: "chat/approval.respond",
      data: {
        chatId: "chat1",
        userId: "user-1",
        userName: "Test User",
        userEmail: "test@example.com",
        assistantMessageId: MESSAGE_ID,
        userMessageId: "user-msg-1",
        decisions: [
          { approvalId: "aitxt-a", approved: true },
          { approvalId: "aitxt-b", approved: false },
        ],
      },
    });

    const sent = JSON.stringify(inngestSend.mock.calls[0][0].data);
    expect(sent).not.toContain("sigA");
    expect(sent).not.toContain("sigB");
    expect(sent).not.toContain("delete_skill_file");
    expect(sent).not.toContain("send_email");
  });

  it("drops an approvalId the database does not know", async () => {
    stubRow({ pendingApprovals: pending });

    await respondToToolApproval({
      assistantMessageId: MESSAGE_ID,
      decisions: [
        { approvalId: "aitxt-a", approved: true },
        { approvalId: "aitxt-b", approved: false },
        { approvalId: "forged", approved: true },
      ],
    });

    expect(inngestSend.mock.calls[0][0].data.decisions).toEqual([
      { approvalId: "aitxt-a", approved: true },
      { approvalId: "aitxt-b", approved: false },
    ]);
  });

  it("rejects a partial answer, which the SDK cannot resume (V7)", async () => {
    stubRow({ pendingApprovals: pending });

    await expect(
      respondToToolApproval({
        assistantMessageId: MESSAGE_ID,
        decisions: [{ approvalId: "aitxt-a", approved: true }],
      }),
    ).rejects.toThrow(/all pending tool calls must be answered together/i);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("rejects when the caller does not own the chat", async () => {
    selectWhere.mockResolvedValue([]);

    await expect(
      respondToToolApproval({
        assistantMessageId: MESSAGE_ID,
        decisions: [{ approvalId: "aitxt-a", approved: true }],
      }),
    ).rejects.toThrow(/Not Found/);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("is a no-op when nothing is pending, so a double click is harmless (Review Focus 4)", async () => {
    parseMetadataMock.mockReturnValue({
      pendingApprovals: [],
      approvalRound: 1,
      parentUserMessageId: "user-msg-1",
    });
    stubRow({ pendingApprovals: [] });

    await expect(
      respondToToolApproval({
        assistantMessageId: MESSAGE_ID,
        decisions: [{ approvalId: "aitxt-a", approved: true }],
      }),
    ).resolves.toEqual({ success: true });
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("refuses to dispatch when the parked row lost its parent user message", async () => {
    parseMetadataMock.mockReturnValue({
      pendingApprovals: pending,
      approvalRound: 1,
      parentUserMessageId: null,
    });
    stubRow({ pendingApprovals: pending });

    await expect(
      respondToToolApproval({
        assistantMessageId: MESSAGE_ID,
        decisions: [
          { approvalId: "aitxt-a", approved: true },
          { approvalId: "aitxt-b", approved: true },
        ],
      }),
    ).rejects.toThrow(/Not Found/);
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("treats an unreadable metadata blob as nothing pending", async () => {
    // A row written before the metadata schema existed parses to null, so the
    // `?? []` fallback has to stand in for the pending list.
    parseMetadataMock.mockReturnValue(null);
    stubRow({ pendingApprovals: pending });

    await expect(
      respondToToolApproval({
        assistantMessageId: MESSAGE_ID,
        decisions: [{ approvalId: "aitxt-a", approved: true }],
      }),
    ).resolves.toEqual({ success: true });
    expect(inngestSend).not.toHaveBeenCalled();
  });

  it("logs the approve and deny counts", async () => {
    stubRow({ pendingApprovals: pending });

    await respondToToolApproval({
      assistantMessageId: MESSAGE_ID,
      decisions: [
        { approvalId: "aitxt-a", approved: true },
        { approvalId: "aitxt-b", approved: false },
      ],
    });

    expect(mockLog.info).toHaveBeenCalledWith(
      expect.stringContaining("Tool approval decisions recorded"),
      { chatId: "chat1", approved: 1, denied: 1 },
    );
  });
});