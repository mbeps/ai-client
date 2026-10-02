import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPublish = vi.hoisted(() => vi.fn());
const mockPersist = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockRunChatGeneration = vi.hoisted(() => vi.fn());
const mockBuildResume = vi.hoisted(() => vi.fn());
const mockParseMetadata = vi.hoisted(() => vi.fn());
const mockSelectWhere = vi.hoisted(() => vi.fn());

// Wrapped, not replaced: the module under test calls `inngest.createFunction`
// at import time, so the real client must survive. Only the outbound calls are
// stubbed.
vi.mock("@/lib/inngest/client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/inngest/client")>();
  return {
    inngest: {
      ...actual.inngest,
      realtime: { ...actual.inngest.realtime, publish: mockPublish },
      send: vi.fn(),
    },
  };
});

vi.mock("@/lib/chat/persist-response", () => ({
  persistAssistantResponse: mockPersist,
  updateAssistantResponse: mockUpdate,
}));

vi.mock("@/lib/chat/run-chat-generation", () => ({
  runChatGeneration: mockRunChatGeneration,
}));

vi.mock("@/lib/chat/build-approval-resume", () => ({
  buildApprovalResumeMessages: mockBuildResume,
}));

vi.mock("@/lib/chat/parse-message-metadata", () => ({
  parseMessageMetadata: mockParseMetadata,
}));

const selectChain = vi.hoisted(() => {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "from", "update", "set"]) {
    c[m] = vi.fn().mockImplementation(() => c);
  }
  c.where = mockSelectWhere;
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: selectChain }));

vi.mock("@/drizzle/schema", () => ({
  message: { id: "id", chatId: "chatId", metadata: "metadata" },
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ and: a }),
  eq: (...a: unknown[]) => ({ eq: a }),
}));

const abortState = vi.hoisted(() => ({
  controller: undefined as AbortController | undefined,
}));

vi.mock("@/lib/chat/chat-abort-registry", () => ({
  chatAbortRegistry: {
    register: vi.fn(() => abortState.controller),
    delete: vi.fn(),
  },
}));

// Dual export shape per .agents/testing.md.
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

import { generateChatResponse } from "@/lib/inngest/functions/chat-response";

const fn = (
  generateChatResponse as unknown as { fn: (args: unknown) => unknown }
).fn;

const RESUME_MESSAGES = [
  { role: "assistant", content: [] },
  { role: "tool", content: [] },
];

const PENDING = [
  {
    approvalId: "aitxt-1",
    toolCallId: "call_1",
    toolName: "delete_skill_file",
    args: { path: "a" },
    signature: "sig-1",
  },
];

const doneOutcome = {
  kind: "done" as const,
  modelId: "gpt-4o",
  content: "Hello there!",
  reasoning: "because",
  toolCalls: [{ toolCallId: "tc-1", toolName: "search", args: {} }],
  toolResults: [
    { toolCallId: "tc-1", toolName: "search", result: { ok: 1 } },
  ],
  usage: { totalTokens: 9 },
  finishReason: "stop",
};

const parkedOutcome = {
  kind: "awaiting-approval" as const,
  modelId: "gpt-4o",
  content: "partial",
  reasoning: "",
  toolCalls: [],
  toolResults: [],
  usage: { totalTokens: 4 },
  finishReason: "tool-calls",
  approvals: PENDING,
  round: 1,
};

const generateEvent = {
  name: "chat/response.generate",
  data: {
    chatId: "chat-1",
    userId: "user-1",
    userName: "Alice Smith",
    userEmail: "alice@example.com",
    userMessageId: "user-msg-1",
    model: "gpt-4o",
  },
};

const approvalEvent = {
  name: "chat/approval.respond",
  data: {
    chatId: "chat-1",
    userId: "user-1",
    userName: "Alice Smith",
    userEmail: "alice@example.com",
    userMessageId: "user-msg-1",
    assistantMessageId: "assistant-msg-1",
    decisions: [{ approvalId: "aitxt-1", approved: true }],
  },
};

describe("generateChatResponse Inngest function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    abortState.controller = new AbortController();
    mockRunChatGeneration.mockResolvedValue(doneOutcome);
    mockBuildResume.mockReturnValue(RESUME_MESSAGES);
    mockParseMetadata.mockReturnValue({
      pendingApprovals: PENDING,
      approvalRound: 1,
      parentUserMessageId: "user-msg-1",
    });
    // The parked row read only ever goes through the `.where()` tail.
    mockSelectWhere.mockResolvedValue([{ metadata: "{}" }]);
  });

  describe("the generate trigger", () => {
    it("announces a fresh message id and delegates one round", async () => {
      await fn({ event: generateEvent });

      expect(mockPublish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "start" }),
      );

      const input = mockRunChatGeneration.mock.calls[0][0];
      expect(input).toMatchObject({
        userId: "user-1",
        userName: "Alice Smith",
        userEmail: "alice@example.com",
        chatId: "chat-1",
        userMessageId: "user-msg-1",
        model: "gpt-4o",
        previousRound: 0,
      });
      expect(input.abortSignal).toBe(abortState.controller.signal);
      expect(typeof input.emit).toBe("function");
    });

    it("fails closed to the ask mode when the event carries none", async () => {
      await fn({ event: generateEvent });

      expect(mockRunChatGeneration.mock.calls[0][0].approvalMode).toBe("ask");
    });

    it("forwards an explicit auto mode and the selection fields", async () => {
      await fn({
        event: {
          name: "chat/response.generate",
          data: {
            ...generateEvent.data,
            approvalMode: "auto",
            selectedServerIds: ["srv-1"],
            selectedTools: ["internal:tool:manage_artifact"],
            selectedAssistantId: "asst-1",
            selectedSkillIds: ["skill-1"],
            selectedKbIds: ["kb-1"],
          },
        },
      });

      expect(mockRunChatGeneration.mock.calls[0][0]).toMatchObject({
        approvalMode: "auto",
        selectedServerIds: ["srv-1"],
        selectedTools: ["internal:tool:manage_artifact"],
        selectedAssistantId: "asst-1",
        selectedSkillIds: ["skill-1"],
        selectedKbIds: ["kb-1"],
      });
    });

    it("inserts the assistant row and emits finish when the round completes", async () => {
      await fn({ event: generateEvent });

      const persisted = mockPersist.mock.calls[0][0];
      expect(persisted).toMatchObject({
        chatId: "chat-1",
        parentId: "user-msg-1",
        content: "Hello there!",
      });
      expect(mockUpdate).not.toHaveBeenCalled();

      const metadata = JSON.parse(persisted.metadata);
      expect(metadata).toMatchObject({
        model: "gpt-4o",
        reasoning: "because",
        usage: { totalTokens: 9 },
        finishReason: "stop",
        pendingApprovals: [],
      });
      expect(metadata.toolCalls).toEqual(doneOutcome.toolCalls);
      expect(metadata.toolResults).toEqual(doneOutcome.toolResults);

      expect(mockPublish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish", finishReason: "stop" }),
      );
    });

    it("persists the parked state and returns without a finish event", async () => {
      mockRunChatGeneration.mockResolvedValue(parkedOutcome);

      const result = await fn({ event: generateEvent });

      expect(result).toBeUndefined();
      const metadata = JSON.parse(mockPersist.mock.calls[0][0].metadata);
      expect(metadata.pendingApprovals).toEqual(PENDING);
      expect(metadata.approvalRound).toBe(1);
      expect(metadata.parentUserMessageId).toBe("user-msg-1");
      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish" }),
      );
      expect(mockLog.info).toHaveBeenCalledWith(
        "Chat paused for tool approval (chatId: {chatId}, round: {round})",
        { chatId: "chat-1", round: 1 },
      );
    });
  });

  describe("the approval resume trigger", () => {
    it("does not announce a start, because the client has the message", async () => {
      await fn({ event: approvalEvent });

      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "start" }),
      );
    });

    it("rebuilds the approval pair from the stored row and forwards the verdicts", async () => {
      await fn({ event: approvalEvent });

      expect(mockBuildResume).toHaveBeenCalledWith(PENDING, [
        { approvalId: "aitxt-1", approved: true },
      ]);
      expect(mockRunChatGeneration.mock.calls[0][0]).toMatchObject({
        userMessageId: "user-msg-1",
        resumeMessages: RESUME_MESSAGES,
        previousRound: 1,
        approvalMode: "ask",
      });
    });

    it("passes empty selections when the user message records none", async () => {
      // The parent row is absent from the stubbed result, so every selection
      // falls back to empty rather than to undefined, which would leave the
      // tool set unregistered on the resume.
      await fn({ event: approvalEvent });

      const input = mockRunChatGeneration.mock.calls[0][0];
      expect(input.model).toBeUndefined();
      expect(input.selectedServerIds).toEqual([]);
      expect(input.selectedTools).toEqual([]);
      expect(input.selectedSkillIds).toEqual([]);
      expect(input.selectedKbIds).toEqual([]);
    });

    it("rewrites the paused row rather than adding a second message", async () => {
      await fn({ event: approvalEvent });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: "assistant-msg-1",
          chatId: "chat-1",
          content: "Hello there!",
        }),
      );
      expect(mockPersist).not.toHaveBeenCalled();
      expect(mockPublish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish" }),
      );
    });

    it("rewrites the row with fresh pending state when it parks again", async () => {
      mockRunChatGeneration.mockResolvedValue({
        ...parkedOutcome,
        approvals: [PENDING[0], { ...PENDING[0], approvalId: "aitxt-2" }],
        round: 2,
      });

      await fn({ event: approvalEvent });

      const metadata = JSON.parse(mockUpdate.mock.calls[0][0].metadata);
      expect(metadata.approvalRound).toBe(2);
      expect(metadata.pendingApprovals).toHaveLength(2);
      expect(metadata.parentUserMessageId).toBe("user-msg-1");
      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "finish" }),
      );
    });

    it("throws when the parked row is gone, rather than guessing the thread", async () => {
      mockSelectWhere.mockResolvedValue([]);

      await expect(fn({ event: approvalEvent })).rejects.toThrow(
        "Message Not Found",
      );
      expect(mockRunChatGeneration).not.toHaveBeenCalled();
    });

    it("throws when the parked row has no parent user message", async () => {
      mockParseMetadata.mockReturnValue({
        pendingApprovals: PENDING,
        approvalRound: 1,
        parentUserMessageId: null,
      });

      await expect(fn({ event: approvalEvent })).rejects.toThrow(
        "Approval Context Not Found",
      );
      expect(mockRunChatGeneration).not.toHaveBeenCalled();
    });

    it("answers with an empty pair when nothing is pending", async () => {
      mockParseMetadata.mockReturnValue({
        pendingApprovals: [],
        approvalRound: 1,
        parentUserMessageId: "user-msg-1",
      });

      await fn({ event: approvalEvent });

      expect(mockBuildResume).toHaveBeenCalledWith([], [
        { approvalId: "aitxt-1", approved: true },
      ]);
    });

    it("answers with an empty verdict list when the event carries none", async () => {
      const { decisions: _absent, ...dataWithoutDecisions } = approvalEvent.data;

      await fn({
        event: { name: approvalEvent.name, data: dataWithoutDecisions },
      });

      expect(mockBuildResume).toHaveBeenCalledWith(PENDING, []);
    });

    it("reloads the tool selection from the parent user message", async () => {
      // The selection is not on the resume event, and `runChatGeneration`
      // registers no tools without it. Reading it back is what keeps the
      // approved tool registered, otherwise the SDK has nothing to execute and
      // the model just claims the tool ran.
      mockParseMetadata
        .mockReturnValueOnce({
          pendingApprovals: PENDING,
          approvalRound: 1,
          parentUserMessageId: "user-msg-1",
        })
        .mockReturnValueOnce({
          model: "gpt-4o",
          selectedServerIds: ["server-1"],
          selectedTools: ["internal:tool:manage_skill"],
          selectedSkillIds: ["skill-1"],
          selectedKbIds: ["kb-1"],
          modelId: "gpt-4o",
        });
      mockSelectWhere.mockResolvedValue([
        { metadata: JSON.stringify({ pendingApprovals: PENDING }) },
        { metadata: JSON.stringify({ selectedTools: ["internal:tool:manage_skill"] }) },
      ]);

      await fn({ event: approvalEvent });

      expect(mockRunChatGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          selectedTools: ["internal:tool:manage_skill"],
          selectedServerIds: ["server-1"],
          selectedSkillIds: ["skill-1"],
          selectedKbIds: ["kb-1"],
          model: "gpt-4o",
        }),
      );
    });
  });

  describe("error handling", () => {
    it("publishes the classified code and rethrows so the run is marked failed", async () => {
      mockRunChatGeneration.mockRejectedValueOnce(
        new Error("Maximum context length exceeded: requested 8192 tokens"),
      );

      await expect(fn({ event: generateEvent })).rejects.toThrow();
      expect(mockPublish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "error",
          code: "CONTEXT_WINDOW_EXCEEDED",
        }),
      );
    });

    it("rethrows a non-Error throwable and emits a generic message", async () => {
      const thrown = { code: "E_PROVIDER", detail: "socket hang up" };
      mockRunChatGeneration.mockRejectedValueOnce(thrown);

      await expect(fn({ event: generateEvent })).rejects.toBe(thrown);
      expect(mockPublish).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "error",
          message: "Generation failed",
        }),
      );
      expect(mockLog.error).toHaveBeenCalledWith(
        "Chat generation failed in Inngest (chatId: {chatId}): {error}",
        { chatId: "chat-1", error: "Generation failed" },
      );
    });

    it("swallows the failure when the signal is aborted, emitting no error", async () => {
      const controller = new AbortController();
      abortState.controller = controller;
      mockRunChatGeneration.mockImplementationOnce(async () => {
        controller.abort();
        throw new Error("Boom after abort");
      });

      const result = await fn({ event: generateEvent });

      expect(result).toBeUndefined();
      expect(mockLog.info).toHaveBeenCalledWith(
        "Chat generation cleanly aborted by user (chatId: {chatId})",
        { chatId: "chat-1" },
      );
      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "error" }),
      );
    });

    it("treats an AbortError-named error as a clean abort", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockRunChatGeneration.mockRejectedValueOnce(abortError);

      await expect(fn({ event: generateEvent })).resolves.toBeUndefined();
      expect(mockPublish).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "error" }),
      );
    });

    it("swallows a publish failure and keeps generating", async () => {
      mockPublish.mockRejectedValueOnce("redis exploded");

      await fn({ event: generateEvent });

      expect(mockLog.warn).toHaveBeenCalledWith(
        "Failed to publish chat stream event to Inngest Realtime",
        { error: "redis exploded", type: "start" },
      );
      expect(mockPersist).toHaveBeenCalled();
    });

    it("logs the message of a thrown Error from the realtime publish", async () => {
      mockPublish.mockRejectedValueOnce(new Error("socket closed by peer"));

      await fn({ event: generateEvent });

      expect(mockLog.warn).toHaveBeenCalledWith(
        "Failed to publish chat stream event to Inngest Realtime",
        { error: "socket closed by peer", type: "start" },
      );
      expect(mockPersist).toHaveBeenCalled();
    });

    it("drops every event once the signal is aborted", async () => {
      const controller = new AbortController();
      abortState.controller = controller;
      controller.abort();

      await fn({ event: generateEvent });

      expect(mockPublish).not.toHaveBeenCalled();
    });
  });
});