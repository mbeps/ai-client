import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStreamText = vi.hoisted(() => vi.fn());
const mockConsumeModelStream = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("ai", () => ({
  streamText: mockStreamText,
  isStepCount: vi.fn().mockReturnValue("step-count-checker"),
}));

vi.mock("@/lib/inngest/chat-response/chat-stream-consumer", () => ({
  consumeModelStream: mockConsumeModelStream,
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => mockLogger,
}));

import {
  needsFallbackSynthesis,
  runSynthesisFallbackPass,
} from "@/lib/inngest/chat-response/chat-synthesis-pass";

describe("chat-synthesis-pass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("needsFallbackSynthesis", () => {
    it("returns false if aborted", () => {
      expect(needsFallbackSynthesis(true, "", 1)).toBe(false);
    });

    it("returns false if accumulatedText is non-empty", () => {
      expect(needsFallbackSynthesis(false, "Some answer", 1)).toBe(false);
      expect(needsFallbackSynthesis(false, "   non-empty   ", 2)).toBe(false);
    });

    it("returns false if completedToolsCount is 0", () => {
      expect(needsFallbackSynthesis(false, "", 0)).toBe(false);
    });

    it("returns true when not aborted, text is empty, and tools executed", () => {
      expect(needsFallbackSynthesis(false, "", 1)).toBe(true);
      expect(needsFallbackSynthesis(false, "   ", 3)).toBe(true);
    });
  });

  describe("runSynthesisFallbackPass", () => {
    const mockChat = vi.fn().mockReturnValue("chat-model-instance");
    const mockResolved = {
      sdkProvider: {
        chat: mockChat,
      },
    };

    it("runs synthesis pass with reasoningEffort header and artifact tools", async () => {
      const abortController = new AbortController();
      mockStreamText.mockReturnValue({
        fullStream: "mock-stream",
      });
      mockConsumeModelStream.mockResolvedValue({
        accumulatedText: "Synthesized report",
        accumulatedReasoning: "Deep synthesis logic",
      });

      const result = await runSynthesisFallbackPass({
        chatId: "chat-123",
        finalMessages: [{ role: "user", content: "Write a report" } as any],
        completedTools: [
          {
            toolCallId: "call-1",
            toolName: "web_search",
            args: { query: "vitest" },
            result: "Search results text",
          },
        ],
        hasArtifactTool: true,
        artifactTools: { manage_artifact: {} as any },
        resolved: mockResolved as any,
        resolvedModelId: "gpt-4o",
        abortController,
        systemPrompt: "You are an assistant",
        emit: vi.fn(),
        toolSourceMap: {},
        reasoningEffort: "high",
      });

      expect(result).toEqual({
        text: "Synthesized report",
        reasoning: "Deep synthesis logic",
      });

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { "x-ai-client-reasoning-effort": "high" },
          instructions: "You are an assistant",
          tools: { manage_artifact: {} },
        }),
      );
    });

    it("handles tools with object or null results and undefined reasoningEffort", async () => {
      const abortController = new AbortController();
      mockStreamText.mockReturnValue({
        fullStream: "mock-stream",
      });
      mockConsumeModelStream.mockResolvedValue({
        accumulatedText: "Response without artifact tools",
        accumulatedReasoning: "",
      });

      const result = await runSynthesisFallbackPass({
        chatId: "chat-456",
        finalMessages: [],
        completedTools: [
          {
            toolCallId: "call-2",
            toolName: "calculator",
            args: { expr: "2+2" },
            result: { calculated: 4 },
          },
          {
            toolCallId: "call-3",
            toolName: "empty_tool",
            args: {},
            result: null,
          },
        ],
        hasArtifactTool: false,
        artifactTools: undefined,
        resolved: mockResolved as any,
        resolvedModelId: "claude-3-5",
        abortController,
        systemPrompt: "System",
        emit: vi.fn(),
        toolSourceMap: {},
      });

      expect(result).toEqual({
        text: "Response without artifact tools",
        reasoning: "",
      });

      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: undefined,
          tools: undefined,
        }),
      );
    });

    it("catches streamText failure and logs warning, returning empty result", async () => {
      const abortController = new AbortController();
      mockStreamText.mockImplementation(() => {
        throw new Error("Stream connection failed");
      });

      const result = await runSynthesisFallbackPass({
        chatId: "chat-err",
        finalMessages: [],
        completedTools: [],
        hasArtifactTool: false,
        artifactTools: undefined,
        resolved: mockResolved as any,
        resolvedModelId: "gpt-4o",
        abortController,
        systemPrompt: "System",
        emit: vi.fn(),
        toolSourceMap: {},
      });

      expect(result).toEqual({ text: "", reasoning: "" });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Synthesis fallback pass encountered error"),
        expect.objectContaining({ error: "Stream connection failed" }),
      );
    });

    it("catches non-Error streamText failure and converts to string", async () => {
      const abortController = new AbortController();
      mockStreamText.mockImplementation(() => {
        throw "String error";
      });

      const result = await runSynthesisFallbackPass({
        chatId: "chat-err-string",
        finalMessages: [],
        completedTools: [],
        hasArtifactTool: false,
        artifactTools: undefined,
        resolved: mockResolved as any,
        resolvedModelId: "gpt-4o",
        abortController,
        systemPrompt: "System",
        emit: vi.fn(),
        toolSourceMap: {},
      });

      expect(result).toEqual({ text: "", reasoning: "" });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Synthesis fallback pass encountered error"),
        expect.objectContaining({ error: "String error" }),
      );
    });
  });
});
