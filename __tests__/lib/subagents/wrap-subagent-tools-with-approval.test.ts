import { describe, expect, it, vi } from "vitest";
import { chatApprovalRegistry } from "@/lib/chat/chat-approval-registry";
import { wrapSubagentToolsWithApproval } from "@/lib/subagents/wrap-subagent-tools-with-approval";

describe("wrapSubagentToolsWithApproval", () => {
  it("leaves auto-approved tools untouched and wraps gated tools", async () => {
    const autoExec = vi.fn().mockResolvedValue({ ok: "auto" });
    const gatedExec = vi.fn().mockResolvedValue({ ok: "gated" });
    const emit = vi.fn().mockResolvedValue(undefined);
    const persistPendingApprovals = vi.fn().mockResolvedValue(undefined);

    const wrapped = wrapSubagentToolsWithApproval({
      workerTools: {
        search_knowledge_base: { execute: autoExec },
        dangerous_tool: { execute: gatedExec },
      },
      toolApprovalMap: {
        search_knowledge_base: "not-applicable",
        dangerous_tool: "user-approval",
      },
      subagentId: "agent-1",
      subagentName: "Researcher",
      toolSourceMap: { dangerous_tool: "GitHub" },
      toolServerIdMap: { dangerous_tool: "srv-1" },
      assistantMessageId: "msg-1",
      chatId: "chat-1",
      abortSignal: new AbortController().signal,
      emit,
      persistPendingApprovals,
      getNextRound: () => 1,
      maxRounds: 10,
    });

    const autoResult = await wrapped.search_knowledge_base.execute(
      { q: "test" },
      { toolCallId: "tc-auto" },
    );
    expect(autoResult).toEqual({ ok: "auto" });
    expect(emit).not.toHaveBeenCalled();

    const gatedPromise = wrapped.dangerous_tool.execute(
      { repo: "ai" },
      { toolCallId: "tc-gated" },
    );

    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledTimes(1);
    });

    expect(persistPendingApprovals).toHaveBeenCalledTimes(1);
    const emittedEvent = emit.mock.calls[0]?.[0];
    expect(emittedEvent).toMatchObject({
      type: "tool-approval-required",
      round: 1,
      approvals: [
        expect.objectContaining({
          toolCallId: "tc-gated",
          toolName: "dangerous_tool",
          serverName: "GitHub",
          serverId: "srv-1",
          subagentId: "agent-1",
          subagentName: "Researcher",
          args: { repo: "ai" },
        }),
      ],
    });

    const approvalId = emittedEvent.approvals[0].approvalId;
    expect(
      chatApprovalRegistry.resolve("msg-1", [{ approvalId, approved: true }]),
    ).toBe(true);

    const gatedResult = await gatedPromise;
    expect(gatedResult).toEqual({ ok: "gated" });
    expect(gatedExec).toHaveBeenCalledWith(
      { repo: "ai" },
      { toolCallId: "tc-gated" },
    );
  });

  it("coalesces multiple gated calls in one step, executes approved ones sequentially in emission order, and denies rejected ones", async () => {
    const order: string[] = [];
    const toolAExec = vi.fn(async () => {
      order.push("A:start");
      await new Promise((r) => setTimeout(r, 15));
      order.push("A:end");
      return "result-A";
    });
    const toolBExec = vi.fn(async () => {
      order.push("B:start");
      return "result-B";
    });
    const toolCExec = vi.fn(async () => {
      order.push("C:start");
      return "result-C";
    });

    const emit = vi.fn().mockResolvedValue(undefined);
    const persistPendingApprovals = vi.fn().mockResolvedValue(undefined);

    const wrapped = wrapSubagentToolsWithApproval({
      workerTools: {
        tool_a: { execute: toolAExec },
        tool_b: { execute: toolBExec },
        tool_c: { execute: toolCExec },
      },
      toolApprovalMap: {
        tool_a: "user-approval",
        tool_b: "user-approval",
        tool_c: "user-approval",
      },
      subagentId: "agent-2",
      subagentName: "Worker",
      toolSourceMap: {},
      toolServerIdMap: {},
      assistantMessageId: "msg-batch",
      chatId: "chat-1",
      abortSignal: new AbortController().signal,
      emit,
      persistPendingApprovals,
      getNextRound: () => 1,
      maxRounds: 10,
    });

    const pA = wrapped.tool_a.execute({ step: 1 }, { toolCallId: "tc-a" });
    const pB = wrapped.tool_b.execute({ step: 2 }, { toolCallId: "tc-b" });
    const pC = wrapped.tool_c.execute({ step: 3 }, { toolCallId: "tc-c" });

    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledTimes(1);
    });

    const approvals = emit.mock.calls[0]?.[0].approvals;
    expect(approvals).toHaveLength(3);
    expect(approvals.map((a: any) => a.toolName)).toEqual([
      "tool_a",
      "tool_b",
      "tool_c",
    ]);

    chatApprovalRegistry.resolve("msg-batch", [
      { approvalId: approvals[0].approvalId, approved: true },
      { approvalId: approvals[1].approvalId, approved: false },
      { approvalId: approvals[2].approvalId, approved: true },
    ]);

    const [resA, resB, resC] = await Promise.all([pA, pB, pC]);
    expect(resA).toBe("result-A");
    expect(resB).toEqual({ error: "Denied by user" });
    expect(resC).toBe("result-C");
    expect(toolBExec).not.toHaveBeenCalled();
    expect(order).toEqual(["A:start", "A:end", "C:start"]);
  });

  it("rejects gated tool execution when maxRounds is exceeded", async () => {
    const gatedExec = vi.fn();
    const emit = vi.fn().mockResolvedValue(undefined);
    const persistPendingApprovals = vi.fn().mockResolvedValue(undefined);

    const wrapped = wrapSubagentToolsWithApproval({
      workerTools: {
        dangerous_tool: { execute: gatedExec },
      },
      toolApprovalMap: {
        dangerous_tool: "user-approval",
      },
      subagentId: "agent-1",
      subagentName: "Researcher",
      toolSourceMap: {},
      toolServerIdMap: {},
      assistantMessageId: "msg-cap",
      chatId: "chat-1",
      abortSignal: new AbortController().signal,
      emit,
      persistPendingApprovals,
      getNextRound: () => 11,
      maxRounds: 10,
    });

    const res = await wrapped.dangerous_tool.execute(
      {},
      { toolCallId: "tc-cap" },
    );
    expect(res).toEqual({ error: "Maximum tool approval rounds exceeded" });
    expect(emit).not.toHaveBeenCalled();
    expect(gatedExec).not.toHaveBeenCalled();
  });

  it("propagates rejection when approval wait is aborted or underlying tool throws", async () => {
    const abortController = new AbortController();
    const emit = vi.fn().mockResolvedValue(undefined);
    const persistPendingApprovals = vi.fn().mockResolvedValue(undefined);

    const wrapped = wrapSubagentToolsWithApproval({
      workerTools: {
        failing_tool: {
          execute: vi.fn().mockRejectedValue(new Error("boom")),
        },
        no_exec_tool: {},
      },
      toolApprovalMap: {
        failing_tool: "user-approval",
        no_exec_tool: "user-approval",
      },
      subagentId: "agent-1",
      subagentName: "Researcher",
      toolSourceMap: {},
      toolServerIdMap: {},
      assistantMessageId: "msg-err",
      chatId: "chat-1",
      abortSignal: abortController.signal,
      emit,
      persistPendingApprovals,
      getNextRound: () => 1,
      maxRounds: 10,
    });

    const pFail = wrapped.failing_tool.execute({}, { toolCallId: "tc-fail" });
    const pNoExec = wrapped.no_exec_tool.execute(
      {},
      { toolCallId: "tc-noexec" },
    );

    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledTimes(1);
    });
    const approvals = emit.mock.calls[0]?.[0].approvals;
    chatApprovalRegistry.resolve("msg-err", [
      { approvalId: approvals[0].approvalId, approved: true },
      { approvalId: approvals[1].approvalId, approved: true },
    ]);

    await expect(pFail).rejects.toThrow("boom");
    await expect(pNoExec).resolves.toEqual({
      error: "Tool has no execute handler",
    });

    // Abort wait test
    const wrappedAbort = wrapSubagentToolsWithApproval({
      workerTools: {
        slow_tool: { execute: vi.fn() },
      },
      toolApprovalMap: { slow_tool: "user-approval" },
      subagentId: "agent-1",
      subagentName: "Researcher",
      toolSourceMap: {},
      toolServerIdMap: {},
      assistantMessageId: "msg-abort",
      chatId: "chat-1",
      abortSignal: abortController.signal,
      emit,
      persistPendingApprovals,
      getNextRound: () => 1,
      maxRounds: 10,
    });

    const pAbort = wrappedAbort.slow_tool.execute({}, {});
    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledTimes(2);
    });
    abortController.abort(new Error("User stopped"));
    await expect(pAbort).rejects.toThrow("User stopped");
  });

  it("registers the waiter before persist/emit and releases it if persist or emit fails", async () => {
    const events: string[] = [];
    const persistPendingApprovals = vi.fn(async () => {
      events.push(
        `persist:hasWaiter=${chatApprovalRegistry.has("msg-pre-reg")}`,
      );
    });
    const emit = vi.fn(async () => {
      events.push(`emit:hasWaiter=${chatApprovalRegistry.has("msg-pre-reg")}`);
      throw new Error("Realtime offline");
    });

    const wrapped = wrapSubagentToolsWithApproval({
      workerTools: { tool_a: { execute: vi.fn() } },
      toolApprovalMap: { tool_a: "user-approval" },
      subagentId: "agent-1",
      subagentName: "Researcher",
      toolSourceMap: {},
      toolServerIdMap: {},
      assistantMessageId: "msg-pre-reg",
      chatId: "chat-1",
      abortSignal: new AbortController().signal,
      emit,
      persistPendingApprovals,
      getNextRound: () => 1,
      maxRounds: 10,
    });

    await expect(
      wrapped.tool_a.execute({}, { toolCallId: "tc-pre" }),
    ).rejects.toThrow("Realtime offline");

    expect(events).toEqual([
      "persist:hasWaiter=true",
      "emit:hasWaiter=true",
    ]);
    expect(chatApprovalRegistry.has("msg-pre-reg")).toBe(false);
  });

  it("serializes concurrent wrappers sharing one assistantMessageId without superseding each other", async () => {
    let currentRound = 0;
    const getNextRound = () => ++currentRound;
    const persistedRounds: Array<{ round: number; tools: string[] }> = [];
    const emittedRounds: Array<{ round: number; approvals: any[] }> = [];

    const persistPendingApprovals = vi.fn(async (approvals, round) => {
      persistedRounds.push({
        round,
        tools: approvals.map((a: any) => a.toolName),
      });
    });
    const emit = vi.fn(async (evt: any) => {
      emittedRounds.push({ round: evt.round, approvals: evt.approvals });
    });

    const execA = vi.fn().mockResolvedValue("res-a");
    const execB = vi.fn().mockResolvedValue("res-b");

    const wrapperA = wrapSubagentToolsWithApproval({
      workerTools: { tool_a: { execute: execA } },
      toolApprovalMap: { tool_a: "user-approval" },
      subagentId: "sub-a",
      subagentName: "Agent A",
      toolSourceMap: {},
      toolServerIdMap: {},
      assistantMessageId: "msg-concurrent",
      chatId: "chat-1",
      abortSignal: new AbortController().signal,
      emit,
      persistPendingApprovals,
      getNextRound,
      maxRounds: 10,
    });

    const wrapperB = wrapSubagentToolsWithApproval({
      workerTools: { tool_b: { execute: execB } },
      toolApprovalMap: { tool_b: "user-approval" },
      subagentId: "sub-b",
      subagentName: "Agent B",
      toolSourceMap: {},
      toolServerIdMap: {},
      assistantMessageId: "msg-concurrent",
      chatId: "chat-1",
      abortSignal: new AbortController().signal,
      emit,
      persistPendingApprovals,
      getNextRound,
      maxRounds: 10,
    });

    const pA = wrapperA.tool_a.execute({}, { toolCallId: "tc-a" });
    const pB = wrapperB.tool_b.execute({}, { toolCallId: "tc-b" });

    // Only round 1 should be persisted & emitted initially
    await vi.waitFor(() => {
      expect(emittedRounds).toHaveLength(1);
    });
    expect(persistedRounds).toEqual([{ round: 1, tools: ["tool_a"] }]);

    const appA = emittedRounds[0].approvals[0].approvalId;
    expect(
      chatApprovalRegistry.resolve("msg-concurrent", [
        { approvalId: appA, approved: true },
      ]),
    ).toBe(true);

    // Round 2 starts only after round 1 is resolved
    await vi.waitFor(() => {
      expect(emittedRounds).toHaveLength(2);
    });
    expect(persistedRounds).toEqual([
      { round: 1, tools: ["tool_a"] },
      { round: 2, tools: ["tool_b"] },
    ]);

    const appB = emittedRounds[1].approvals[0].approvalId;
    expect(
      chatApprovalRegistry.resolve("msg-concurrent", [
        { approvalId: appB, approved: true },
      ]),
    ).toBe(true);

    await expect(Promise.all([pA, pB])).resolves.toEqual(["res-a", "res-b"]);
  });

  it("checks abortSignal before each approved tool starts and skips remaining handlers on cancellation", async () => {
    const abortController = new AbortController();
    const emit = vi.fn().mockResolvedValue(undefined);
    const persistPendingApprovals = vi.fn().mockResolvedValue(undefined);

    const execFirst = vi.fn(async () => {
      abortController.abort(new Error("Cancelled mid-batch"));
      return "first-ok";
    });
    const execSecond = vi.fn().mockResolvedValue("second-should-not-run");

    const wrapped = wrapSubagentToolsWithApproval({
      workerTools: {
        first_tool: { execute: execFirst },
        second_tool: { execute: execSecond },
      },
      toolApprovalMap: {
        first_tool: "user-approval",
        second_tool: "user-approval",
      },
      subagentId: "agent-1",
      subagentName: "Worker",
      toolSourceMap: {},
      toolServerIdMap: {},
      assistantMessageId: "msg-mid-abort",
      chatId: "chat-1",
      abortSignal: abortController.signal,
      emit,
      persistPendingApprovals,
      getNextRound: () => 1,
      maxRounds: 10,
    });

    const p1 = wrapped.first_tool.execute({}, { toolCallId: "tc-1" });
    const p2 = wrapped.second_tool.execute({}, { toolCallId: "tc-2" });

    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledTimes(1);
    });
    const approvals = emit.mock.calls[0]?.[0].approvals;
    chatApprovalRegistry.resolve("msg-mid-abort", [
      { approvalId: approvals[0].approvalId, approved: true },
      { approvalId: approvals[1].approvalId, approved: true },
    ]);

    await expect(p1).resolves.toBe("first-ok");
    await expect(p2).rejects.toThrow("Cancelled mid-batch");
    expect(execSecond).not.toHaveBeenCalled();
  });

  it("rejects queued wrapper waiting on the lock when abortSignal fires with a non-Error reason", async () => {
    const abortController = new AbortController();
    const emit = vi.fn().mockResolvedValue(undefined);
    const persistPendingApprovals = vi.fn().mockResolvedValue(undefined);

    const w1 = wrapSubagentToolsWithApproval({
      workerTools: { tool_1: { execute: vi.fn() } },
      toolApprovalMap: { tool_1: "user-approval" },
      subagentId: "sub-1",
      subagentName: "One",
      toolSourceMap: {},
      toolServerIdMap: {},
      assistantMessageId: "msg-lock-abort",
      chatId: "chat-1",
      abortSignal: abortController.signal,
      emit,
      persistPendingApprovals,
      getNextRound: () => 1,
      maxRounds: 10,
    });
    const w2 = wrapSubagentToolsWithApproval({
      workerTools: { tool_2: { execute: vi.fn() } },
      toolApprovalMap: { tool_2: "user-approval" },
      subagentId: "sub-2",
      subagentName: "Two",
      toolSourceMap: {},
      toolServerIdMap: {},
      assistantMessageId: "msg-lock-abort",
      chatId: "chat-1",
      abortSignal: abortController.signal,
      emit,
      persistPendingApprovals,
      getNextRound: () => 2,
      maxRounds: 10,
    });

    const p1 = w1.tool_1.execute({}, { toolCallId: "tc-1" });
    const p2 = w2.tool_2.execute({}, { toolCallId: "tc-2" });

    await vi.waitFor(() => {
      expect(emit).toHaveBeenCalledTimes(1);
    });

    abortController.abort("string-abort");
    await expect(p1).rejects.toThrow("Approval wait aborted");
    await expect(p2).rejects.toThrow("Approval wait aborted");
  });
});
