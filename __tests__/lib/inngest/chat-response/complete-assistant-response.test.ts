import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAssistantMessageMetadata,
  completeAssistantResponse,
  persistAbortedAssistantResponse,
} from "@/lib/inngest/chat-response/complete-assistant-response";

const mockPersistResponse = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/persist-response", () => ({
  persistAssistantResponse: mockPersistResponse,
}));

const mockExecuteDownloadFallback = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/tool-download-fallback", () => ({
  executeToolDownloadFallback: mockExecuteDownloadFallback,
}));

const mockDeleteScratchpadFiles = vi.hoisted(() => vi.fn());
vi.mock("@/lib/subagents/delete-scratchpad-files", () => ({
  deleteScratchpadFiles: mockDeleteScratchpadFiles,
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

describe("complete-assistant-response", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistResponse.mockResolvedValue(true);
    mockExecuteDownloadFallback.mockResolvedValue([]);
    mockDeleteScratchpadFiles.mockResolvedValue(undefined);
  });

  describe("completeAssistantResponse", () => {
    it("executes download fallback, persists assistant message, and emits finish event", async () => {
      const emit = vi.fn().mockResolvedValue(undefined);
      const controller = new AbortController();

      await completeAssistantResponse({
        chatId: "chat-1",
        assistantMessageId: "asst-1",
        userMessageId: "user-1",
        accumulatedText: "Done with everything",
        accumulatedReasoning: "Thought deeply",
        resolvedModelId: "gpt-4o",
        completedTools: [
          {
            toolCallId: "tc-1",
            toolName: "calc",
            args: { a: 1 },
            result: 2,
            serverName: "math-server",
          },
        ],
        allTools: { calc: {} },
        toolSourceMap: { calc: "math-server" },
        safeFinishReason: Promise.resolve("stop"),
        safeUsage: Promise.resolve({ totalTokens: 100 }),
        abortSignal: controller.signal,
        emit,
      });

      expect(mockExecuteDownloadFallback).toHaveBeenCalled();
      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: "chat-1",
          assistantMessageId: "asst-1",
          content: "Done with everything",
          parentId: "user-1",
        }),
      );
      expect(emit).toHaveBeenCalledWith({
        type: "finish",
        finishReason: "stop",
        usage: { totalTokens: 100 },
      });
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining("successfully generated and persisted"),
        expect.anything(),
      );
    });

    it("halts and deletes scratchpad files when abortSignal is aborted before persistence", async () => {
      const emit = vi.fn();
      const controller = new AbortController();
      controller.abort();

      await completeAssistantResponse({
        chatId: "chat-2",
        assistantMessageId: "asst-2",
        userMessageId: "user-2",
        accumulatedText: "Partial",
        accumulatedReasoning: "",
        resolvedModelId: "gpt-4o",
        completedTools: [],
        toolSourceMap: {},
        safeFinishReason: Promise.resolve("stop"),
        safeUsage: Promise.resolve(undefined),
        abortSignal: controller.signal,
        emit,
      });

      expect(mockPersistResponse).not.toHaveBeenCalled();
      expect(mockDeleteScratchpadFiles).toHaveBeenCalledWith("asst-2");
      expect(emit).not.toHaveBeenCalled();
    });

    it("skips emit when persistAssistantResponse returns false (concurrent deletion)", async () => {
      mockPersistResponse.mockResolvedValueOnce(false);
      const emit = vi.fn();
      const controller = new AbortController();

      await completeAssistantResponse({
        chatId: "chat-3",
        assistantMessageId: "asst-3",
        userMessageId: "user-3",
        accumulatedText: "Never saved",
        accumulatedReasoning: "",
        resolvedModelId: "gpt-4o",
        completedTools: [],
        toolSourceMap: {},
        safeFinishReason: Promise.resolve("stop"),
        safeUsage: Promise.resolve(undefined),
        abortSignal: controller.signal,
        emit,
      });

      expect(mockDeleteScratchpadFiles).toHaveBeenCalledWith("asst-3");
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe("persistAbortedAssistantResponse", () => {
    it("returns early when there is no text, reasoning, or tool calls", async () => {
      await persistAbortedAssistantResponse({
        chatId: "chat-empty",
        assistantMessageId: "asst-empty",
        userMessageId: "user-empty",
        resolvedModelId: "gpt-4o",
        accumulatedText: "",
        accumulatedReasoning: "",
        completedTools: [],
      });

      expect(mockPersistResponse).not.toHaveBeenCalled();
    });

    it("persists partial content with stopped: true in metadata", async () => {
      await persistAbortedAssistantResponse({
        chatId: "chat-stopped",
        assistantMessageId: "asst-stopped",
        userMessageId: "user-stopped",
        resolvedModelId: "claude-sonnet",
        accumulatedText: "Partial response before stop",
        accumulatedReasoning: "Some reasoning",
        completedTools: [
          {
            toolCallId: "tc-stop",
            toolName: "fetch_data",
            args: { id: 1 },
            result: { data: "test" },
          },
        ],
      });

      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: "chat-stopped",
          assistantMessageId: "asst-stopped",
          content: "Partial response before stop",
          parentId: "user-stopped",
          metadata: expect.stringContaining('"stopped":true'),
        }),
      );

      const parsedMeta = JSON.parse(mockPersistResponse.mock.calls[0][0].metadata);
      expect(parsedMeta).toMatchObject({
        model: "claude-sonnet",
        reasoning: "Some reasoning",
        finishReason: "stop",
        stopped: true,
        toolCalls: [{ toolCallId: "tc-stop", toolName: "fetch_data" }],
      });
    });
  });

  describe("buildAssistantMessageMetadata", () => {
    it("handles interrupted tool executions with fallback error object", () => {
      const json = buildAssistantMessageMetadata({
        modelId: "gpt-4o",
        reasoning: "reason",
        completedTools: [
          {
            toolCallId: "tc-interrupted",
            toolName: "heavy_task",
            args: {},
            result: undefined,
          },
        ],
        usage: { totalTokens: 10 },
        finishReason: "length",
      });

      const parsed = JSON.parse(json);
      expect(parsed.toolResults[0].result).toEqual({
        error: "Tool execution was interrupted",
      });
      expect(parsed.finishReason).toBe("length");
    });
  });
});

