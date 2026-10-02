import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV3 } from "ai/test";

const streamTextMock = vi.hoisted(() => vi.fn());

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, streamText: streamTextMock };
});

const sdkProvider = {
  chat: () => new MockLanguageModelV3({ doStream: async () => ({}) }),
};

vi.mock("@/lib/chat/resolve-provider", () => ({
  resolveProvider: vi.fn(async () => ({
    modelId: "gpt-4o",
    modelRow: { capVision: true, capTools: true },
    sdkProvider,
  })),
}));

vi.mock("@/lib/chat/resolve-default-chat-provider", () => ({
  resolveDefaultChatProvider: vi.fn(async () => ({
    modelId: "default-model",
    modelRow: { capVision: false, capTools: false },
    sdkProvider,
  })),
}));

vi.mock("@/lib/chat/load-chat-context", () => ({
  loadChatContext: vi.fn(async () => ({
    servers: [],
    activeKbId: null,
    kbIsReady: false,
    activeKbIds: [],
    availableSkills: [],
    selectedSkills: [],
    projectRow: null,
    assistantRow: null,
  })),
}));

vi.mock("@/lib/chat/load-thread-from-db", () => ({
  loadThreadFromDb: vi.fn(async () => []),
}));

vi.mock("@/lib/chat/prepare-chat-messages", () => ({
  prepareChatMessages: vi.fn(() => [{ role: "user", content: "hello" }]),
}));

vi.mock("@/lib/chat/build-system-prompt", () => ({
  buildSystemPrompt: vi.fn(() => "system"),
}));

// Mutable so a test can decide whether the server registered any MCP tool,
// and so the cleanup spy has a stable identity to assert on.
const mcpState = vi.hoisted(() => ({
  tools: { mcp_tool_a: { description: "a" } } as Record<string, unknown>,
  cleanup: vi.fn(async () => {}),
}));

vi.mock("@/lib/chat/register-mcp-tools", () => ({
  registerMcpTools: vi.fn(async () => ({
    mcpTools: mcpState.tools,
    toolSourceMap: {},
    mcpCleanup: mcpState.cleanup,
  })),
}));

vi.mock("@/lib/chat/register-file-url-tool", () => ({
  registerFileUrlTool: vi.fn(() => ({})),
}));
vi.mock("@/lib/chat/register-skill-tool", () => ({
  registerSkillTool: vi.fn(() => ({})),
}));
vi.mock("@/lib/chat/register-skill-authoring-tools", () => ({
  registerSkillAuthoringTools: vi.fn(() => ({
    delete_skill_file: { description: "d" },
    manage_artifact: { description: "m" },
  })),
}));
vi.mock("@/lib/chat/vision-guard", () => ({
  checkVisionSupport: vi.fn(() => true),
}));
vi.mock("@/lib/user/get-user-settings-by-id", () => ({
  getUserSettingsByUserId: vi.fn(async () => null),
}));

import { env } from "@/config/env";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { loadChatContext } from "@/lib/chat/load-chat-context";
import { loadThreadFromDb } from "@/lib/chat/load-thread-from-db";
import { registerFileUrlTool } from "@/lib/chat/register-file-url-tool";
import { registerSkillTool } from "@/lib/chat/register-skill-tool";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import { runChatGeneration } from "@/lib/chat/run-chat-generation";
import { checkVisionSupport } from "@/lib/chat/vision-guard";
import type { ChatStreamEvent } from "@/lib/inngest/channels";
import { getUserSettingsByUserId } from "@/lib/user/get-user-settings-by-id";

/** The context every test assumes before it overrides anything. */
const emptyContext = {
  servers: [],
  activeKbId: null,
  kbIsReady: false,
  activeKbIds: [],
  availableSkills: [],
  selectedSkills: [],
  projectRow: null,
  assistantRow: null,
};

/** The two promises the module reads only after the stream is drained. */
type StreamOverrides = {
  finishReason?: unknown;
  usage?: unknown;
};

function fakeStream(parts: unknown[], overrides: StreamOverrides = {}) {
  streamTextMock.mockReturnValue({
    fullStream: (async function* () {
      for (const p of parts) yield p;
    })(),
    finishReason:
      overrides.finishReason === undefined
        ? Promise.resolve("tool-calls")
        : overrides.finishReason,
    usage:
      overrides.usage === undefined
        ? Promise.resolve({ totalTokens: 10 })
        : overrides.usage,
  });
}

/**
 * A promise that is already rejected, with a handler attached so Node does not
 * report an unhandled rejection before the module under test reaches it.
 */
function alreadyRejected(reason: unknown): Promise<never> {
  const promise = Promise.reject(reason);
  promise.catch(() => {});
  return promise;
}

/** Restores every collaborator to the state the other tests assume. */
function resetCollaborators() {
  mcpState.tools = { mcp_tool_a: { description: "a" } };
  vi.mocked(resolveProvider).mockResolvedValue({
    modelId: "gpt-4o",
    modelRow: { capVision: true, capTools: true },
    sdkProvider,
  } as never);
  vi.mocked(loadChatContext).mockResolvedValue(emptyContext as never);
  vi.mocked(loadThreadFromDb).mockResolvedValue([]);
  vi.mocked(checkVisionSupport).mockReturnValue(true);
  vi.mocked(getUserSettingsByUserId).mockResolvedValue(null as never);
}

const baseInput = {
  userId: "u1",
  userName: "Test",
  userEmail: "t@e.c",
  chatId: "c1",
  userMessageId: "m1",
  model: "gpt-4o",
  approvalMode: "ask" as const,
  previousRound: 0,
  abortSignal: new AbortController().signal,
  emit: async () => {},
};

describe("runChatGeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // `clearAllMocks` keeps implementations, so a test that used
    // `mockResolvedValue` would otherwise leak into the next one.
    resetCollaborators();
  });

  it("maps every registered tool and signs approvals (V14)", async () => {
    fakeStream([{ type: "text-delta", text: "hi" }]);
    await runChatGeneration(baseInput);

    const options = streamTextMock.mock.calls[0][0];
    expect(options.toolApproval).toEqual({
      mcp_tool_a: "user-approval",
      delete_skill_file: "user-approval",
      manage_artifact: "not-applicable",
    });
    expect(options.experimental_toolApprovalSecret).toBe(
      env.TOOL_APPROVAL_SECRET,
    );
  });

  it("returns done with accumulated content when nothing is requested", async () => {
    fakeStream([
      { type: "text-delta", text: "hi" },
      { type: "reasoning-delta", text: "why" },
    ]);

    const outcome = await runChatGeneration(baseInput);

    expect(outcome.kind).toBe("done");
    if (outcome.kind !== "done") throw new Error("expected done");
    expect(outcome.modelId).toBe("gpt-4o");
    expect(outcome.content).toBe("hi");
    expect(outcome.reasoning).toBe("why");
    expect(outcome.finishReason).toBe("tool-calls");
  });

  it("parks on approval without recording the blocked call (V1)", async () => {
    fakeStream([
      {
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "delete_skill_file",
        input: { path: "a" },
      },
      {
        type: "tool-approval-request",
        approvalId: "aitxt-1",
        toolCall: {
          type: "tool-call",
          toolCallId: "call_1",
          toolName: "delete_skill_file",
          input: { path: "a" },
        },
        signature: "sig-1",
      },
    ]);

    const emitted: ChatStreamEvent[] = [];
    const outcome = await runChatGeneration({
      ...baseInput,
      emit: async (e) => {
        emitted.push(e);
      },
    });

    expect(outcome.kind).toBe("awaiting-approval");
    if (outcome.kind !== "awaiting-approval") throw new Error("expected park");
    expect(outcome.approvals).toEqual([
      {
        approvalId: "aitxt-1",
        toolCallId: "call_1",
        toolName: "delete_skill_file",
        args: { path: "a" },
        signature: "sig-1",
      },
    ]);
    expect(outcome.round).toBe(1);
    expect(outcome.toolCalls).toEqual([]);
    expect(emitted).toContainEqual({
      type: "tool-approval-required",
      approvals: outcome.approvals,
      round: 1,
    });
  });

  it("turns a denial into a readable error result (Review Focus 3)", async () => {
    fakeStream([
      {
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "delete_skill_file",
        input: { path: "a" },
      },
      {
        type: "tool-output-denied",
        toolCallId: "call_1",
        toolName: "delete_skill_file",
      },
      { type: "text-delta", text: "Understood." },
    ]);

    const emitted: ChatStreamEvent[] = [];
    const outcome = await runChatGeneration({
      ...baseInput,
      emit: async (e) => {
        emitted.push(e);
      },
    });

    expect(outcome.kind).toBe("done");
    if (outcome.kind !== "done") throw new Error("expected done");
    expect(outcome.toolResults).toEqual([
      {
        toolCallId: "call_1",
        toolName: "delete_skill_file",
        result: { error: "Denied by user" },
      },
    ]);
    expect(emitted).toContainEqual({
      type: "tool-result",
      toolCallId: "call_1",
      toolName: "delete_skill_file",
      result: { error: "Denied by user" },
    });
    expect(outcome.content).toBe("Understood.");
  });

  it("refuses to open a new round past the cap (V13)", async () => {
    fakeStream([
      {
        type: "tool-call",
        toolCallId: "call_9",
        toolName: "delete_skill_file",
        input: {},
      },
      {
        type: "tool-approval-request",
        approvalId: "aitxt-9",
        toolCall: {
          type: "tool-call",
          toolCallId: "call_9",
          toolName: "delete_skill_file",
          input: {},
        },
        signature: "sig-9",
      },
    ]);

    const emitted: ChatStreamEvent[] = [];
    const outcome = await runChatGeneration({
      ...baseInput,
      previousRound: env.CHAT_MAX_APPROVAL_ROUNDS,
      emit: async (e) => {
        emitted.push(e);
      },
    });

    expect(outcome.kind).toBe("done");
    expect(
      emitted.some((e) => e.type === "tool-approval-required"),
    ).toBe(false);
  });

  it("appends resume messages after the prepared thread", async () => {
    fakeStream([{ type: "text-delta", text: "ok" }]);

    const resume = [{ role: "assistant", content: [] }] as never[];
    await runChatGeneration({ ...baseInput, resumeMessages: resume });

    const options = streamTextMock.mock.calls[0][0];
    expect(options.messages).toEqual([
      { role: "user", content: "hello" },
      ...resume,
    ]);
  });

  describe("user settings", () => {
    it("folds the stored global prompt in when settings load", async () => {
      vi.mocked(getUserSettingsByUserId).mockResolvedValue({
        globalSystemPrompt: "Speak like a butler.",
      } as never);
      fakeStream([{ type: "text-delta", text: "hi" }]);

      await runChatGeneration(baseInput);

      // The prompt layers are read with optional chaining, so a null row
      // arrives as `undefined` rather than `null`.
      expect(buildSystemPrompt).toHaveBeenCalledWith(
        "Speak like a butler.",
        undefined,
        undefined,
        false,
        expect.objectContaining({
          userContext: { name: "Test", email: "t@e.c" },
        }),
      );
    });

    it("carries on without a global prompt when the settings read rejects", async () => {
      vi.mocked(getUserSettingsByUserId).mockRejectedValue(
        new Error("settings table unavailable"),
      );
      fakeStream([{ type: "text-delta", text: "hi" }]);

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("done");
      expect(buildSystemPrompt).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        false,
        expect.objectContaining({ attachmentNames: [] }),
      );
    });

    it("passes the project and assistant prompt layers through", async () => {
      vi.mocked(loadChatContext).mockResolvedValue({
        ...emptyContext,
        activeKbId: "kb-1",
        kbIsReady: true,
        activeKbIds: ["kb-1"],
        projectRow: { globalPrompt: "Project layer." },
        assistantRow: { prompt: "Assistant layer." },
      } as never);
      fakeStream([{ type: "text-delta", text: "hi" }]);

      await runChatGeneration(baseInput);

      expect(buildSystemPrompt).toHaveBeenCalledWith(
        undefined,
        "Project layer.",
        "Assistant layer.",
        true,
        expect.objectContaining({ attachmentNames: [] }),
      );
    });
  });

  describe("model resolution and capability guards", () => {
    it("uses the default provider when no model was requested", async () => {
      // The default model cannot call tools, so no MCP tool may be registered.
      mcpState.tools = {};
      fakeStream([{ type: "text-delta", text: "hi" }]);

      const outcome = await runChatGeneration({
        ...baseInput,
        model: undefined,
      });

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.modelId).toBe("default-model");
    });

    it("refuses a thread with images when the model cannot see", async () => {
      vi.mocked(checkVisionSupport).mockReturnValue(false);
      fakeStream([{ type: "text-delta", text: "never read" }]);

      await expect(runChatGeneration(baseInput)).rejects.toMatchObject({
        name: "VisionNotSupportedError",
      });
      // The finally block must still release the MCP session.
      expect(mcpState.cleanup).toHaveBeenCalledOnce();
      expect(streamTextMock).not.toHaveBeenCalled();
    });

    it("refuses MCP tools on a model that cannot call them", async () => {
      vi.mocked(resolveProvider).mockResolvedValue({
        modelId: "gpt-4o",
        modelRow: { capVision: true, capTools: false },
        sdkProvider,
      } as never);
      fakeStream([{ type: "text-delta", text: "never read" }]);

      await expect(runChatGeneration(baseInput)).rejects.toMatchObject({
        name: "ToolsNotSupportedError",
      });
      expect(mcpState.cleanup).toHaveBeenCalledOnce();
      expect(streamTextMock).not.toHaveBeenCalled();
    });
  });

  describe("the attachment pipeline", () => {
    it("keeps only keyed attachments and names them in the system prompt", async () => {
      vi.mocked(loadThreadFromDb).mockResolvedValue([
        {
          role: "user",
          content: "read these",
          attachments: [
            { name: "report.pdf", key: "u1/report.pdf", type: "file" },
            // An extracted-only attachment has no storage key, so it cannot be
            // fetched later and must not be offered to the model.
            { name: "scratch.png", type: "image" },
          ],
        },
        // No attachments at all, which exercises the `?? []` fallback.
        { role: "assistant", content: "sure" },
      ] as never);
      fakeStream([{ type: "text-delta", text: "ok" }]);

      await runChatGeneration(baseInput);

      expect(registerFileUrlTool).toHaveBeenCalledWith([
        { name: "report.pdf", key: "u1/report.pdf", type: "file" },
      ]);
      expect(buildSystemPrompt).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        false,
        expect.objectContaining({ attachmentNames: ["report.pdf"] }),
      );
    });

    it("offers no attachment names when nothing is keyed", async () => {
      vi.mocked(loadThreadFromDb).mockResolvedValue([
        {
          role: "user",
          content: "read these",
          attachments: [{ name: "scratch.png", type: "image" }],
        },
      ] as never);
      fakeStream([{ type: "text-delta", text: "ok" }]);

      await runChatGeneration(baseInput);

      expect(registerFileUrlTool).not.toHaveBeenCalled();
      expect(buildSystemPrompt).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
        false,
        expect.objectContaining({ attachmentNames: [] }),
      );
    });
  });

  describe("tool registration", () => {
    it("registers the skill tool when the user has skills", async () => {
      mcpState.tools = {};
      vi.mocked(loadChatContext).mockResolvedValue({
        ...emptyContext,
        availableSkills: [{ id: "s1", name: "writer" }],
        selectedSkills: [{ id: "s1", name: "writer" }],
      } as never);
      fakeStream([{ type: "text-delta", text: "ok" }]);

      await runChatGeneration(baseInput);

      expect(registerSkillTool).toHaveBeenCalledWith("u1");
      expect(streamTextMock.mock.calls[0][0].tools).toMatchObject({
        delete_skill_file: expect.anything(),
      });
    });

    it("caps the step count when any tool is available", async () => {
      fakeStream([{ type: "text-delta", text: "ok" }]);

      await runChatGeneration(baseInput);

      const stopWhen = streamTextMock.mock.calls[0][0].stopWhen;
      expect(stopWhen).toBeTypeOf("function");
      expect(stopWhen({ steps: [] })).toBe(false);
      expect(stopWhen({ steps: new Array(env.CHAT_MAX_STEPS).fill({}) })).toBe(
        true,
      );
    });

    it("leaves the step count uncapped when there is nothing to call", async () => {
      mcpState.tools = {};
      fakeStream([{ type: "text-delta", text: "ok" }]);

      const outcome = await runChatGeneration(baseInput);

      expect(streamTextMock.mock.calls[0][0].stopWhen).toBeUndefined();
      expect(streamTextMock.mock.calls[0][0].tools).toEqual({});
      expect(outcome.kind).toBe("done");
    });
  });

  describe("stream outcomes", () => {
    it("records an interrupted marker for a call that never returned", async () => {
      fakeStream([
        {
          type: "tool-call",
          toolCallId: "call_x",
          toolName: "mcp_tool_a",
          input: {},
        },
        { type: "text-delta", text: "done" },
      ]);

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.toolCalls).toEqual([
        { toolCallId: "call_x", toolName: "mcp_tool_a", args: {} },
      ]);
      expect(outcome.toolResults).toEqual([
        {
          toolCallId: "call_x",
          toolName: "mcp_tool_a",
          result: { error: "Tool execution was interrupted" },
        },
      ]);
    });

    it("falls back to a stop finish reason when the read rejects", async () => {
      fakeStream([{ type: "text-delta", text: "ok" }], {
        finishReason: alreadyRejected(new Error("provider closed the socket")),
        usage: alreadyRejected(new Error("usage unavailable")),
      });

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.finishReason).toBe("stop");
      expect(outcome.usage).toBeUndefined();
    });

    it("returns the partial round when the signal aborts mid-stream", async () => {
      const controller = new AbortController();
      const emitted: ChatStreamEvent[] = [];
      streamTextMock.mockReturnValue({
        // The abort lands between the two chunks, so the loop sees it on the
        // next iteration rather than the post-loop guard.
        fullStream: (async function* () {
          yield { type: "text-delta", text: "partial" };
          controller.abort();
          yield { type: "text-delta", text: "never" };
        })(),
        finishReason: Promise.resolve("stop"),
        usage: Promise.resolve({ totalTokens: 1 }),
      });

      const outcome = await runChatGeneration({
        ...baseInput,
        abortSignal: controller.signal,
        emit: async (e) => {
          emitted.push(e);
        },
      });

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.content).toBe("partial");
      // An aborted round deliberately drops usage and finishReason, which are
      // only safe to read once the stream is fully drained.
      expect(outcome.usage).toBeUndefined();
      expect(outcome.finishReason).toBeUndefined();
      expect(emitted).toEqual([{ type: "text-delta", text: "partial" }]);
    });

    it("returns the round when the signal was already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      // An empty stream means the loop never re-checks the signal, so the
      // post-loop guard is the one that fires.
      fakeStream([]);

      const outcome = await runChatGeneration({
        ...baseInput,
        abortSignal: controller.signal,
      });

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.content).toBe("");
      expect(outcome.usage).toBeUndefined();
    });
  });

  describe("the SDK chunk order a resume actually produces", () => {
    // Verified against ai@7.0.106: when a resume answers a `tool-approval-response`,
    // the SDK runs the approved tool before the model produces anything, so
    // `tool-result` arrives ahead of the `tool-call` chunk that describes it.
    // Looking the result up by id therefore misses on the first pass, and the
    // outcome of the approved tool is lost from persisted metadata.
    it("does not re-gate a call the resume already resolved", async () => {
      // Verified against ai@7.0.106: when the resume answers an approval, the
      // SDK runs the tool and re-emits the `tool-approval-request` with
      // `isAutomatic: true` as a record of what it already decided. Treating
      // that as a fresh gate marks the call blocked again, so `settled()`
      // filters its result out and the round persists no tool outcome at all.
      fakeStream([
        { type: "tool-result", toolCallId: "call_auto", toolName: "mcp_tool_a", output: "ran" },
        {
          type: "tool-approval-request",
          approvalId: "a-auto",
          toolCall: { toolCallId: "call_auto", toolName: "mcp_tool_a", input: {} },
          isAutomatic: true,
          signature: "sig",
        },
        { type: "tool-call", toolCallId: "call_auto", toolName: "mcp_tool_a", input: {} },
      ]);

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.toolCalls).toEqual([
        { toolCallId: "call_auto", toolName: "mcp_tool_a", args: {} },
      ]);
      expect(outcome.toolResults).toEqual([
        { toolCallId: "call_auto", toolName: "mcp_tool_a", result: "ran" },
      ]);
    });

    it("still gates a genuinely new request", async () => {
      fakeStream([
        { type: "tool-call", toolCallId: "call_new", toolName: "mcp_tool_a", input: {} },
        {
          type: "tool-approval-request",
          approvalId: "a-new",
          toolCall: { toolCallId: "call_new", toolName: "mcp_tool_a", input: {} },
          signature: "sig",
        },
      ]);

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("awaiting-approval");
      if (outcome.kind !== "awaiting-approval") throw new Error("expected gate");
      expect(outcome.approvals).toHaveLength(1);
      expect(outcome.toolCalls).toEqual([]);
    });

    it("keeps a tool result that arrives before its tool call", async () => {
      fakeStream([
        {
          type: "tool-result",
          toolCallId: "call_resumed",
          toolName: "mcp_tool_a",
          output: "approved tool ran",
        },
        {
          type: "tool-call",
          toolCallId: "call_resumed",
          toolName: "mcp_tool_a",
          input: { name: "x" },
        },
      ]);

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.toolCalls).toEqual([
        { toolCallId: "call_resumed", toolName: "mcp_tool_a", args: { name: "x" } },
      ]);
      expect(outcome.toolResults).toEqual([
        {
          toolCallId: "call_resumed",
          toolName: "mcp_tool_a",
          result: "approved tool ran",
        },
      ]);
    });

    it("keeps a tool error that arrives before its tool call", async () => {
      fakeStream([
        {
          type: "tool-error",
          toolCallId: "call_resumed_err",
          toolName: "mcp_tool_a",
          error: new Error("boom"),
        },
        {
          type: "tool-call",
          toolCallId: "call_resumed_err",
          toolName: "mcp_tool_a",
          input: {},
        },
      ]);

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.toolResults).toEqual([
        {
          toolCallId: "call_resumed_err",
          toolName: "mcp_tool_a",
          result: { error: "boom" },
        },
      ]);
    });

    it("keeps a denial marker that arrives before its tool call", async () => {
      fakeStream([
        {
          type: "tool-output-denied",
          toolCallId: "call_resumed_denied",
          toolName: "mcp_tool_a",
        },
        {
          type: "tool-call",
          toolCallId: "call_resumed_denied",
          toolName: "mcp_tool_a",
          input: {},
        },
      ]);

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.toolResults).toEqual([
        {
          toolCallId: "call_resumed_denied",
          toolName: "mcp_tool_a",
          result: { error: "Denied by user" },
        },
      ]);
    });
  });

  describe("stream loop, driven through runChatGeneration", () => {
    it("reads a tool result from either the current or the legacy field", async () => {
      fakeStream([
        {
          type: "tool-call",
          toolCallId: "call_1",
          toolName: "mcp_tool_a",
          input: {},
        },
        {
          type: "tool-call",
          toolCallId: "call_2",
          toolName: "mcp_tool_a",
          input: {},
        },
        {
          type: "tool-result",
          toolCallId: "call_1",
          toolName: "mcp_tool_a",
          result: "current",
        },
        // A null `result` is not a result, so the fallback must read `output`.
        {
          type: "tool-result",
          toolCallId: "call_2",
          toolName: "mcp_tool_a",
          result: null,
          output: "legacy",
        },
      ]);

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.toolResults).toEqual([
        { toolCallId: "call_1", toolName: "mcp_tool_a", result: "current" },
        { toolCallId: "call_2", toolName: "mcp_tool_a", result: "legacy" },
      ]);
    });

    it("emits a result for a call it never saw, instead of dropping it", async () => {
      fakeStream([
        {
          type: "tool-result",
          toolCallId: "call_unknown",
          toolName: "mcp_tool_a",
          output: "orphan",
        },
        {
          type: "tool-output-denied",
          toolCallId: "call_unknown_2",
          toolName: "mcp_tool_a",
        },
      ]);

      const emitted: ChatStreamEvent[] = [];
      const outcome = await runChatGeneration({
        ...baseInput,
        emit: async (e) => {
          emitted.push(e);
        },
      });

      // Nothing to attach the value to, so only the event carries it.
      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.toolResults).toEqual([]);
      expect(emitted).toEqual([
        {
          type: "tool-result",
          toolCallId: "call_unknown",
          toolName: "mcp_tool_a",
          result: "orphan",
        },
        {
          type: "tool-result",
          toolCallId: "call_unknown_2",
          toolName: "mcp_tool_a",
          result: { error: "Denied by user" },
        },
      ]);
    });

    it("reads a tool error as an Error, a string, or a fallback", async () => {
      fakeStream([
        {
          type: "tool-call",
          toolCallId: "call_1",
          toolName: "mcp_tool_a",
          input: {},
        },
        {
          type: "tool-call",
          toolCallId: "call_2",
          toolName: "mcp_tool_a",
          input: {},
        },
        {
          type: "tool-call",
          toolCallId: "call_3",
          toolName: "mcp_tool_a",
          input: {},
        },
        {
          type: "tool-error",
          toolCallId: "call_1",
          toolName: "mcp_tool_a",
          error: new Error("fetch timed out"),
        },
        {
          type: "tool-error",
          toolCallId: "call_2",
          toolName: "mcp_tool_a",
          error: "plain string failure",
        },
        {
          type: "tool-error",
          toolCallId: "call_3",
          toolName: "mcp_tool_a",
          error: { code: 500 },
        },
        // No matching call, so the value is only emitted.
        {
          type: "tool-error",
          toolCallId: "call_4",
          toolName: "mcp_tool_a",
          error: new Error("nobody asked"),
        },
      ]);

      const emitted: ChatStreamEvent[] = [];
      const outcome = await runChatGeneration({
        ...baseInput,
        emit: async (e) => {
          emitted.push(e);
        },
      });

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.toolResults).toEqual([
        {
          toolCallId: "call_1",
          toolName: "mcp_tool_a",
          result: { error: "fetch timed out" },
        },
        {
          toolCallId: "call_2",
          toolName: "mcp_tool_a",
          result: { error: "plain string failure" },
        },
        {
          toolCallId: "call_3",
          toolName: "mcp_tool_a",
          result: { error: "Tool execution failed" },
        },
      ]);
      expect(emitted).toContainEqual({
        type: "tool-result",
        toolCallId: "call_4",
        toolName: "mcp_tool_a",
        result: { error: "nobody asked" },
      });
    });

    it("reads a legacy args field and an absent signature", async () => {
      fakeStream([
        {
          type: "tool-call",
          toolCallId: "call_1",
          toolName: "delete_skill_file",
          args: { path: "legacy" },
        },
        {
          type: "tool-approval-request",
          approvalId: "aitxt-1",
          toolCall: {
            type: "tool-call",
            toolCallId: "call_1",
            toolName: "delete_skill_file",
            input: { path: "legacy" },
          },
        },
      ]);

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("awaiting-approval");
      if (outcome.kind !== "awaiting-approval") throw new Error("expected park");
      expect(outcome.approvals[0].signature).toBe("");
    });

    it("ignores the lifecycle parts the SDK interleaves with the ones it handles", async () => {
      // start, start-step, finish-step, text-start, text-end and finish carry no
      // tool state, so the loop must fall through them without recording anything.
      fakeStream([
        { type: "start" },
        { type: "start-step", stepNumber: 0 },
        { type: "text-start", id: "t0" },
        { type: "text-delta", text: "hi" },
        { type: "text-end", id: "t0" },
        { type: "finish-step", stepNumber: 0 },
        { type: "finish" },
      ]);

      const outcome = await runChatGeneration(baseInput);

      expect(outcome.kind).toBe("done");
      if (outcome.kind !== "done") throw new Error("expected done");
      expect(outcome.content).toBe("hi");
      expect(outcome.toolCalls).toEqual([]);
      expect(outcome.toolResults).toEqual([]);
    });
  });
});