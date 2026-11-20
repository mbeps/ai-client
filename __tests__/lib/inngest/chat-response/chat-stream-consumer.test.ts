import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPublish = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    send: vi.fn(),
    realtime: {
      publish: mockPublish,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => mockLogger,
}));

import {
  consumeModelStream,
  createStreamEmitter,
  DELTA_COALESCE_INTERVAL_MS,
} from "@/lib/inngest/chat-response/chat-stream-consumer";

describe("chat-stream-consumer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createStreamEmitter", () => {
    it("publishes events to Inngest Realtime", async () => {
      const abortController = new AbortController();
      const emitter = createStreamEmitter(
        abortController.signal,
        "test-stream" as any,
      );

      await emitter({ type: "text-delta", text: "hello" });

      expect(mockPublish).toHaveBeenCalledWith("test-stream", {
        type: "text-delta",
        text: "hello",
      });
    });

    it("skips publishing if abort signal is already aborted", async () => {
      const abortController = new AbortController();
      abortController.abort();
      const emitter = createStreamEmitter(
        abortController.signal,
        "test-stream" as any,
      );

      await emitter({ type: "text-delta", text: "hello" });

      expect(mockPublish).not.toHaveBeenCalled();
    });

    it("logs a warning when publish rejects with an Error", async () => {
      const abortController = new AbortController();
      mockPublish.mockRejectedValueOnce(new Error("Network failure"));
      const emitter = createStreamEmitter(
        abortController.signal,
        "test-stream" as any,
      );

      await emitter({ type: "text-delta", text: "fail" });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to publish chat stream event to Inngest Realtime",
        {
          error: "Network failure",
          type: "text-delta",
        },
      );
    });

    it("logs a warning when publish rejects with a non-Error", async () => {
      const abortController = new AbortController();
      mockPublish.mockRejectedValueOnce("Unknown rejection");
      const emitter = createStreamEmitter(
        abortController.signal,
        "test-stream" as any,
      );

      await emitter({ type: "text-delta", text: "fail" });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Failed to publish chat stream event to Inngest Realtime",
        {
          error: "Unknown rejection",
          type: "text-delta",
        },
      );
    });
  });

  describe("consumeModelStream", () => {
    it("coalesces rapid text-delta chunks within the coalesce window", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      async function* generateChunks() {
        yield { type: "text-delta", text: "Hello " };
        yield { type: "text-delta", text: "world" };
        yield { type: "text-delta", text: "!" };
      }

      const abortController = new AbortController();
      const result = await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(result).toEqual({
        accumulatedText: "Hello world!",
        accumulatedReasoning: "",
        aborted: false,
      });

      // Rapid consecutive chunks without time passage should coalesce
      expect(emitted.length).toBeLessThan(3);
      const combinedText = emitted
        .filter((e) => e.type === "text-delta")
        .map((e) => e.text)
        .join("");
      expect(combinedText).toBe("Hello world!");
    });

    it("flushes text-delta after coalesce window passes", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      let currentTime = 1000;
      vi.spyOn(Date, "now").mockImplementation(() => currentTime);

      async function* generateChunks() {
        yield { type: "text-delta", text: "First " };
        currentTime += DELTA_COALESCE_INTERVAL_MS + 10;
        yield { type: "text-delta", text: "Second" };
      }

      const abortController = new AbortController();
      const result = await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(result.accumulatedText).toBe("First Second");
      expect(emitted).toEqual([
        { type: "text-delta", text: "First " },
        { type: "text-delta", text: "Second" },
      ]);

      vi.restoreAllMocks();
    });

    it("coalesces rapid reasoning-delta chunks and flushes before text-delta", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      async function* generateChunks() {
        yield { type: "reasoning-delta", text: "Thinking step 1. " };
        yield { type: "reasoning-delta", text: "Thinking step 2." };
        yield { type: "text-delta", text: "Final answer." };
      }

      const abortController = new AbortController();
      const result = await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(result).toEqual({
        accumulatedText: "Final answer.",
        accumulatedReasoning: "Thinking step 1. Thinking step 2.",
        aborted: false,
      });

      // Reasoning should be emitted before text
      const reasoningEvents = emitted.filter((e) => e.type === "reasoning-delta");
      const textEvents = emitted.filter((e) => e.type === "text-delta");
      expect(reasoningEvents.length).toBeGreaterThan(0);
      expect(textEvents.length).toBeGreaterThan(0);
      expect(
        emitted.findIndex((e) => e.type === "reasoning-delta"),
      ).toBeLessThan(emitted.findIndex((e) => e.type === "text-delta"));
    });

    it("flushes buffered text before tool-call, tool-result, and tool-error", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      const completedTools: any[] = [];
      const toolSourceMap = { search: "test-server" };

      async function* generateChunks() {
        yield { type: "text-delta", text: "Searching now..." };
        yield {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "search",
          args: { query: "weather" },
        };
        yield {
          type: "tool-result",
          toolCallId: "call-1",
          toolName: "search",
          result: { temp: 72 },
          preliminary: false,
        };
        yield { type: "text-delta", text: "Processing error..." };
        yield {
          type: "tool-call",
          toolCallId: "call-2",
          toolName: "search",
          args: { query: "fail" },
        };
        yield {
          type: "tool-error",
          toolCallId: "call-2",
          toolName: "search",
          error: new Error("Tool failed"),
        };
        yield {
          type: "tool-call",
          toolCallId: "call-3",
          toolName: "search",
          args: { query: "string-fail" },
        };
        yield {
          type: "tool-error",
          toolCallId: "call-3",
          toolName: "search",
          error: "String error",
        };
        yield {
          type: "tool-call",
          toolCallId: "call-4",
          toolName: "search",
          args: { query: "object-fail" },
        };
        yield {
          type: "tool-error",
          toolCallId: "call-4",
          toolName: "search",
          error: { code: 500 },
        };
      }

      const abortController = new AbortController();
      const result = await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        toolSourceMap,
        completedTools,
      );

      expect(result.accumulatedText).toBe(
        "Searching now...Processing error...",
      );

      // Verify text-delta was emitted BEFORE the tool-call
      const firstTextIdx = emitted.findIndex(
        (e) => e.type === "text-delta" && e.text.includes("Searching now..."),
      );
      const toolCallIdx = emitted.findIndex((e) => e.type === "tool-call");
      expect(firstTextIdx).toBeLessThan(toolCallIdx);

      // Verify tool error was handled and added to completedTools
      const call2 = completedTools.find((t) => t.toolCallId === "call-2");
      expect(call2?.result).toEqual({ error: "Tool failed" });
      const call3 = completedTools.find((t) => t.toolCallId === "call-3");
      expect(call3?.result).toEqual({ error: "String error" });
      const call4 = completedTools.find((t) => t.toolCallId === "call-4");
      expect(call4?.result).toEqual({ error: JSON.stringify({ code: 500 }) });
    });

    it("handles tool-call with chunk.input and missing serverName in toolSourceMap", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      const completedTools: any[] = [];
      async function* generateChunks() {
        yield {
          type: "tool-call",
          toolCallId: "call-input",
          toolName: "calculator",
          input: { expr: "2+2" },
        };
      }

      const abortController = new AbortController();
      await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        completedTools,
      );

      const tc = completedTools.find((t) => t.toolCallId === "call-input");
      expect(tc).toEqual({
        toolCallId: "call-input",
        toolName: "calculator",
        args: { expr: "2+2" },
        serverName: undefined,
      });
      expect(emitted).toEqual([
        {
          type: "tool-call",
          toolCallId: "call-input",
          toolName: "calculator",
          args: { expr: "2+2" },
          serverName: undefined,
        },
      ]);
    });

    it("handles preliminary tool-result with chunk.output and does not overwrite tc.result", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      const completedTools: any[] = [
        {
          toolCallId: "prelim-1",
          toolName: "stream_calc",
          args: {},
          serverName: "math-server",
        },
      ];

      async function* generateChunks() {
        yield {
          type: "tool-result",
          toolCallId: "prelim-1",
          toolName: "stream_calc",
          output: { progress: 50 },
          preliminary: true,
        };
      }

      const abortController = new AbortController();
      await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        completedTools,
      );

      // Prelim results must NOT update tc.result
      expect(completedTools[0].result).toBeUndefined();
      expect(emitted).toEqual([
        {
          type: "tool-result",
          toolCallId: "prelim-1",
          toolName: "stream_calc",
          result: { progress: 50 },
          serverName: "math-server",
          preliminary: true,
        },
      ]);
    });

    it("handles tool-error without matching toolCall in completedTools", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      const completedTools: any[] = [];
      async function* generateChunks() {
        yield {
          type: "tool-error",
          toolCallId: "orphan-error",
          toolName: "search",
          error: undefined,
        };
      }

      const abortController = new AbortController();
      await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        { search: "server-1" },
        completedTools,
      );

      expect(emitted).toEqual([
        {
          type: "tool-result",
          toolCallId: "orphan-error",
          toolName: "search",
          result: { error: '"Tool execution failed"' },
          serverName: "server-1",
        },
      ]);
    });

    it("ignores unknown non-delta chunk types safely", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      async function* generateChunks() {
        yield { type: "step-finish", step: 1 };
      }

      const abortController = new AbortController();
      const result = await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(result).toEqual({
        accumulatedText: "",
        accumulatedReasoning: "",
        aborted: false,
      });
      expect(emitted).toEqual([]);
    });

    it("flushes buffered text before reasoning-delta if text preceded reasoning", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      async function* generateChunks() {
        yield { type: "text-delta", text: "Text first " };
        yield { type: "text-delta", text: "Text buffered " };
        yield { type: "reasoning-delta", text: "Reasoning after" };
      }

      const abortController = new AbortController();
      const result = await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(result.accumulatedText).toBe("Text first Text buffered ");
      expect(result.accumulatedReasoning).toBe("Reasoning after");
      const textIdx = emitted.findIndex((e) => e.type === "text-delta");
      const reasoningIdx = emitted.findIndex((e) => e.type === "reasoning-delta");
      expect(textIdx).toBeLessThan(reasoningIdx);
    });

    it("handles completely empty stream gracefully", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      async function* generateChunks() {}

      const abortController = new AbortController();
      const result = await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(result).toEqual({
        accumulatedText: "",
        accumulatedReasoning: "",
        aborted: false,
      });
      expect(emitted).toEqual([]);
    });

    it("sanitizes subagent delegate_task output on tool-result", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      const completedTools: any[] = [];
      async function* generateChunks() {
        yield {
          type: "tool-call",
          toolCallId: "sub-1",
          toolName: "delegate_task",
          args: { task: "research" },
        };
        yield {
          type: "tool-result",
          toolCallId: "sub-1",
          toolName: "delegate_task",
          result: "Done [TASK_COMPLETED]",
          preliminary: false,
        };
      }

      const abortController = new AbortController();
      await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        completedTools,
      );

      const tc = completedTools.find((t) => t.toolCallId === "sub-1");
      expect(tc?.result).toBeDefined();
    });

    it("preserves structured UIMessage parts and metadata on final delegate_task tool-result while bounding oversized tool outputs", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      const completedTools: any[] = [];
      const longToolOutput = "X".repeat(5000);
      const subagentUiMessage = {
        id: "run-1",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "Thinking through the KB..." },
          {
            type: "tool-search_knowledge_base",
            toolCallId: "inner-tc-1",
            state: "output-available",
            input: { query: "MCP" },
            output: longToolOutput,
          },
          { type: "text", text: "STATUS: DONE\n\nFound MCP details." },
        ],
        metadata: {
          modelId: "gpt-4o-mini",
          durationMs: 1250,
          stepCount: 2,
          maxSteps: 10,
          finishReason: "stop",
        },
      };

      async function* generateChunks() {
        yield {
          type: "tool-call",
          toolCallId: "sub-ui-1",
          toolName: "delegate_task",
          input: { role: "researcher", taskBrief: "Research MCP" },
        };
        yield {
          type: "tool-result",
          toolCallId: "sub-ui-1",
          toolName: "delegate_task",
          output: subagentUiMessage,
          preliminary: false,
        };
      }

      const abortController = new AbortController();
      await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        completedTools,
      );

      const tc = completedTools.find((t) => t.toolCallId === "sub-ui-1");
      expect(tc?.result).toMatchObject({
        id: "run-1",
        role: "assistant",
        metadata: { modelId: "gpt-4o-mini", durationMs: 1250 },
      });
      expect(tc?.result.parts).toHaveLength(3);
      expect(tc?.result.parts[1].output.length).toBeLessThan(4200);
      expect(tc?.result.parts[1].output).toContain("[... truncated]");
    });

    it("bounds oversized and unserializable object outputs and passes through primitive or non-parts subagent results", async () => {
      const emit = async () => {};
      const completedTools: any[] = [];
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      async function* generateChunks() {
        yield {
          type: "tool-call",
          toolCallId: "sub-obj",
          toolName: "delegate_task",
          input: {},
        };
        yield {
          type: "tool-result",
          toolCallId: "sub-obj",
          toolName: "delegate_task",
          output: {
            parts: [
              { type: "tool-a", output: { data: "Z".repeat(5000) } },
              { type: "tool-b", output: { ok: true } },
              { type: "tool-c", output: circular },
              { type: "tool-d", output: "ok" },
              { type: "tool-e", output: 42 },
            ],
          },
          preliminary: false,
        };
        yield {
          type: "tool-call",
          toolCallId: "sub-prim",
          toolName: "delegate_task",
          input: {},
        };
        yield {
          type: "tool-result",
          toolCallId: "sub-prim",
          toolName: "delegate_task",
          output: "plain-string-result",
          preliminary: false,
        };
        yield {
          type: "tool-call",
          toolCallId: "sub-noparts",
          toolName: "delegate_task",
          input: {},
        };
        yield {
          type: "tool-result",
          toolCallId: "sub-noparts",
          toolName: "delegate_task",
          output: { summary: "no parts array" },
          preliminary: false,
        };
      }

      await consumeModelStream(
        generateChunks(),
        new AbortController().signal,
        emit,
        {},
        completedTools,
      );

      const objRes = completedTools.find((t) => t.toolCallId === "sub-obj")?.result;
      expect(objRes.parts[0].output).toContain("[... truncated]");
      expect(objRes.parts[1].output).toEqual({ ok: true });
      expect(objRes.parts[2].output).toBe("[unserializable output]");

      expect(
        completedTools.find((t) => t.toolCallId === "sub-prim")?.result,
      ).toBe("plain-string-result");
      expect(
        completedTools.find((t) => t.toolCallId === "sub-noparts")?.result,
      ).toEqual({ summary: "no parts array" });
    });

    it("enriches delegate_task tool-call args with resolved agentId and agentName from linkedSubagents", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      const completedTools: any[] = [];
      const customSubagent = {
        id: "26c9a870-8a7c-4b8b-9f1a-111111111111",
        name: "Maruf MCP Researcher",
      } as any;

      async function* generateChunks() {
        yield {
          type: "tool-call",
          toolCallId: "sub-custom",
          toolName: "delegate_task",
          input: {
            agent: "26c9a870-8a7c-4b8b-9f1a-111111111111",
            role: "researcher",
            taskBrief: "Research via MCP",
          },
        };
      }

      const abortController = new AbortController();
      await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        completedTools,
        [customSubagent],
      );

      expect(completedTools[0].args).toEqual({
        agent: "26c9a870-8a7c-4b8b-9f1a-111111111111",
        role: "researcher",
        taskBrief: "Research via MCP",
        agentId: "26c9a870-8a7c-4b8b-9f1a-111111111111",
        agentName: "Maruf MCP Researcher",
      });
      expect(emitted[0]).toMatchObject({
        type: "tool-call",
        toolCallId: "sub-custom",
        toolName: "delegate_task",
        args: expect.objectContaining({
          agentId: "26c9a870-8a7c-4b8b-9f1a-111111111111",
          agentName: "Maruf MCP Researcher",
        }),
      });

      // Also test fallback to DEFAULT_LINKABLE_BUILT_IN_AGENTS when linkedSubagents is omitted,
      // and when input has no matching targetAgent (leaves args unchanged)
      const builtInCompleted: any[] = [];
      async function* generateBuiltInAndUnmatched() {
        yield {
          type: "tool-call",
          toolCallId: "sub-builtin",
          toolName: "internal:tool:delegate_task",
          input: { role: "planner", taskBrief: "Plan steps" },
        };
        yield {
          type: "tool-call",
          toolCallId: "sub-unmatched",
          toolName: "delegate_task",
          input: { agent: "unknown-agent", taskBrief: "Unmatched" },
        };
      }

      await consumeModelStream(
        generateBuiltInAndUnmatched(),
        abortController.signal,
        emit,
        {},
        builtInCompleted,
      );

      expect(builtInCompleted[0].args).toEqual({
        role: "planner",
        taskBrief: "Plan steps",
        agentId: "builtin:planner",
        agentName: "Planner",
      });
      expect(builtInCompleted[1].args).toEqual({
        agent: "unknown-agent",
        taskBrief: "Unmatched",
      });
    });

    it("handles abort signal mid-stream by flushing and returning aborted: true", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      const abortController = new AbortController();
      async function* generateChunks() {
        yield { type: "text-delta", text: "Start..." };
        abortController.abort();
        yield { type: "text-delta", text: "Ignored." };
      }

      const result = await consumeModelStream(
        generateChunks(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(result.aborted).toBe(true);
      expect(result.accumulatedText).toBe("Start...");
    });

    /**
     * The ctx literal initialises flushReasoning/flushText/flushDeltas as
     * no-op placeholders before they are reassigned. The placeholders are
     * unreachable through consumeModelStream (they are overwritten before any
     * call site), so this test exercises the real flush functions directly
     * via the exported consumeModelStream contract: an empty-buffer flush
     * must emit nothing, and a populated-buffer flush must emit exactly the
     * buffered payload once.
     */
    it("flush functions emit nothing for empty buffers and exactly once for populated buffers", async () => {
      const emitted: any[] = [];
      const emit = async (data: any) => {
        emitted.push(data);
      };

      // Empty buffers: the final flushDeltas must not emit anything.
      async function* emptyStream() {
        yield { type: "step-finish" };
      }

      const abortController = new AbortController();
      await consumeModelStream(
        emptyStream(),
        abortController.signal,
        emit,
        {},
        [],
      );
      expect(emitted).toEqual([]);

      // Populated buffers: one text-delta and one reasoning-delta, each
      // emitted exactly once by the final flushDeltas.
      async function* bufferedStream() {
        yield { type: "text-delta", text: "buffered text" };
        yield { type: "reasoning-delta", text: "buffered reasoning" };
        yield { type: "step-finish" };
      }

      const result = await consumeModelStream(
        bufferedStream(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(result).toEqual({
        accumulatedText: "buffered text",
        accumulatedReasoning: "buffered reasoning",
        aborted: false,
      });
      expect(emitted).toEqual([
        { type: "text-delta", text: "buffered text" },
        { type: "reasoning-delta", reasoning: "buffered reasoning" },
      ]);
    });

    it("handles error chunk from stream by converting via toAppError and emitting error event", async () => {
      const abortController = new AbortController();
      const emitted: ChatStreamEvent[] = [];
      const emit = async (event: ChatStreamEvent) => {
        emitted.push(event);
      };

      async function* errorStream() {
        yield { type: "error", error: new Error("Rate limit exceeded") };
      }

      await consumeModelStream(
        errorStream(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(emitted).toEqual([
        expect.objectContaining({
          type: "error",
          message: expect.stringContaining("Rate limit"),
        }),
      ]);
    });

    it("parses inline <think> tags from text-delta into reasoning-delta and text-delta", async () => {
      const abortController = new AbortController();
      const emitted: ChatStreamEvent[] = [];
      const emit = async (event: ChatStreamEvent) => {
        emitted.push(event);
      };

      async function* inlineStream() {
        yield { type: "text-delta", text: "<think>Reasoning step 1. " };
        yield { type: "text-delta", text: "Reasoning step 2.</think>Actual response." };
      }

      const result = await consumeModelStream(
        inlineStream(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(result.accumulatedReasoning).toBe("Reasoning step 1. Reasoning step 2.");
      expect(result.accumulatedText).toBe("Actual response.");
      expect(emitted).toEqual([
        { type: "reasoning-delta", reasoning: "Reasoning step 1. " },
        { type: "reasoning-delta", reasoning: "Reasoning step 2." },
        { type: "text-delta", text: "Actual response." },
      ]);
    });

    it("extracts direct reasoning_content from non-standard delta chunks", async () => {
      const abortController = new AbortController();
      const emitted: ChatStreamEvent[] = [];
      const emit = async (event: ChatStreamEvent) => {
        emitted.push(event);
      };

      async function* customChunkStream() {
        yield { type: "custom", reasoning_content: "Direct thought" };
        yield { type: "text-delta", text: "Direct answer" };
      }

      const result = await consumeModelStream(
        customChunkStream(),
        abortController.signal,
        emit,
        {},
        [],
      );

      expect(result.accumulatedReasoning).toBe("Direct thought");
      expect(result.accumulatedText).toBe("Direct answer");
    });

    it("flushes unclosed reasoning and text buffers on normal completion and abort", async () => {
      // 1. Normal completion with unclosed reasoning tag buffer
      {
        const abortController = new AbortController();
        const emitted: ChatStreamEvent[] = [];
        const emit = async (event: ChatStreamEvent) => {
          emitted.push(event);
        };

        async function* partialCloseStream() {
          yield { type: "text-delta", text: "<think>Unclosed thought </th" };
        }

        const result = await consumeModelStream(
          partialCloseStream(),
          abortController.signal,
          emit,
          {},
          [],
        );

        expect(result.accumulatedReasoning).toBe("Unclosed thought </th");
      }

      // 2. Aborted stream with unclosed reasoning tag buffer
      {
        const abortController = new AbortController();
        const emitted: ChatStreamEvent[] = [];
        const emit = async (event: ChatStreamEvent) => {
          emitted.push(event);
        };

        async function* abortedStream() {
          yield { type: "text-delta", text: "<think>In-flight thought </th" };
          abortController.abort();
          yield { type: "text-delta", text: "never reached" };
        }

        const result = await consumeModelStream(
          abortedStream(),
          abortController.signal,
          emit,
          {},
          [],
        );

        expect(result.aborted).toBe(true);
        expect(result.accumulatedReasoning).toBe("In-flight thought </th");
      }

      // 3. Normal completion with trailing text prefix in buffer
      {
        const abortController = new AbortController();
        const emitted: ChatStreamEvent[] = [];
        const emit = async (event: ChatStreamEvent) => {
          emitted.push(event);
        };

        async function* textPrefixStream() {
          yield { type: "text-delta", text: "Finished response <th" };
        }

        const result = await consumeModelStream(
          textPrefixStream(),
          abortController.signal,
          emit,
          {},
          [],
        );

        expect(result.accumulatedText).toBe("Finished response <th");
      }

      // 4. Aborted stream with trailing text prefix in buffer
      {
        const abortController = new AbortController();
        const emitted: ChatStreamEvent[] = [];
        const emit = async (event: ChatStreamEvent) => {
          emitted.push(event);
        };

        async function* abortedTextPrefixStream() {
          yield { type: "text-delta", text: "In-flight text <th" };
          abortController.abort();
          yield { type: "text-delta", text: "never reached" };
        }

        const result = await consumeModelStream(
          abortedTextPrefixStream(),
          abortController.signal,
          emit,
          {},
          [],
        );

        expect(result.aborted).toBe(true);
        expect(result.accumulatedText).toBe("In-flight text <th");
      }
    });
  });
});
