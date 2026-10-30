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

const mockHasExistingAssistantMessage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/has-existing-assistant-message", () => ({
  hasExistingAssistantMessage: mockHasExistingAssistantMessage,
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
    mockHasExistingAssistantMessage.mockResolvedValue(false);
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
      expect(mockDeleteScratchpadFiles).not.toHaveBeenCalled();
    });

    it("persists aborted response and retains scratchpad files when abortSignal is aborted before persistence with partial content", async () => {
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

      expect(mockPersistResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          chatId: "chat-2",
          assistantMessageId: "asst-2",
          content: "Partial",
          parentId: "user-2",
        }),
      );
      expect(mockDeleteScratchpadFiles).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });

    it("deletes scratchpad files and skips persistence when abortSignal is aborted before persistence with empty content", async () => {
      const emit = vi.fn();
      const controller = new AbortController();
      controller.abort();

      await completeAssistantResponse({
        chatId: "chat-empty-abort",
        assistantMessageId: "asst-empty-abort",
        userMessageId: "user-empty-abort",
        accumulatedText: "",
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
      expect(mockDeleteScratchpadFiles).toHaveBeenCalledWith("asst-empty-abort");
      expect(emit).not.toHaveBeenCalled();
    });

    it("does not delete scratchpad files when persistAssistantResponse returns false because message already exists", async () => {
      mockPersistResponse.mockResolvedValueOnce(false);
      mockHasExistingAssistantMessage.mockResolvedValueOnce(true);
      const emit = vi.fn();
      const controller = new AbortController();

      await completeAssistantResponse({
        chatId: "chat-existing",
        assistantMessageId: "asst-existing",
        userMessageId: "user-existing",
        accumulatedText: "Saved by client",
        accumulatedReasoning: "",
        resolvedModelId: "gpt-4o",
        completedTools: [],
        toolSourceMap: {},
        safeFinishReason: Promise.resolve("stop"),
        safeUsage: Promise.resolve(undefined),
        abortSignal: controller.signal,
        emit,
      });

      expect(mockDeleteScratchpadFiles).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });

    it("skips emit and deletes scratchpad files when persistAssistantResponse returns false and message does not exist (concurrent deletion)", async () => {
      mockPersistResponse.mockResolvedValueOnce(false);
      mockHasExistingAssistantMessage.mockResolvedValueOnce(false);
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
    it("deletes scratchpad files when there is no text, reasoning, or tool calls", async () => {
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
      expect(mockDeleteScratchpadFiles).toHaveBeenCalledWith("asst-empty");
    });

    it("persists partial content with stopped: true and does not delete scratchpad files", async () => {
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
      expect(mockDeleteScratchpadFiles).not.toHaveBeenCalled();

      const parsedMeta = JSON.parse(mockPersistResponse.mock.calls[0][0].metadata);
      expect(parsedMeta).toMatchObject({
        model: "claude-sonnet",
        reasoning: "Some reasoning",
        finishReason: "stop",
        stopped: true,
        toolCalls: [{ toolCallId: "tc-stop", toolName: "fetch_data" }],
      });
    });

    it("does not delete scratchpad files when persistAssistantResponse returns false but message already exists", async () => {
      mockPersistResponse.mockResolvedValueOnce(false);
      mockHasExistingAssistantMessage.mockResolvedValueOnce(true);

      const result = await persistAbortedAssistantResponse({
        chatId: "chat-stopped-exist",
        assistantMessageId: "asst-stopped-exist",
        userMessageId: "user-stopped-exist",
        resolvedModelId: "gpt-4o",
        accumulatedText: "Partial content",
        accumulatedReasoning: "",
        completedTools: [],
      });

      expect(result).toBe(true);
      expect(mockDeleteScratchpadFiles).not.toHaveBeenCalled();
    });

    it("deletes scratchpad files when persistAssistantResponse returns false and message does not exist", async () => {
      mockPersistResponse.mockResolvedValueOnce(false);
      mockHasExistingAssistantMessage.mockResolvedValueOnce(false);

      const result = await persistAbortedAssistantResponse({
        chatId: "chat-stopped-deleted",
        assistantMessageId: "asst-stopped-deleted",
        userMessageId: "user-stopped-deleted",
        resolvedModelId: "gpt-4o",
        accumulatedText: "Partial content",
        accumulatedReasoning: "",
        completedTools: [],
      });

      expect(result).toBe(false);
      expect(mockDeleteScratchpadFiles).toHaveBeenCalledWith("asst-stopped-deleted");
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

