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
  });
});
