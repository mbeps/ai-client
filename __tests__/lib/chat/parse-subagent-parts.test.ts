import { describe, expect, it } from "vitest";
import { parseSubagentResult } from "@/lib/chat/parse-subagent-parts";

describe("parseSubagentResult", () => {
  it("parses reasoning, static tool-* parts, dynamic-tool parts, text, and metadata from a UIMessage", () => {
    const result = parseSubagentResult({
      id: "run-1",
      role: "assistant",
      parts: [
        { type: "step-start" },
        { type: "reasoning", text: "Checking KB first.", state: "done" },
        {
          type: "tool-search_knowledge_base",
          toolCallId: "tc-1",
          state: "output-available",
          input: { query: "MCP" },
          output: { chunks: ["chunk1"] },
        },
        {
          type: "dynamic-tool",
          toolName: "scratchpad_write",
          toolCallId: "tc-2",
          state: "output-available",
          input: { filePath: "mcp.md" },
          output: { success: true, filePath: "mcp.md" },
        },
        {
          type: "tool-web_search",
          toolCallId: "tc-3",
          state: "input-available",
          input: { q: "Maruf" },
        },
        {
          type: "tool-broken_tool",
          toolCallId: "tc-4",
          state: "output-error",
          input: {},
          errorText: "Timeout",
        },
        {
          type: "text",
          text: "<think>hidden</think>STATUS: DONE\n\nSummary here.",
          state: "streaming",
        },
      ],
      metadata: {
        modelId: "gpt-4o-mini",
        durationMs: 2400,
        stepCount: 3,
        maxSteps: 10,
        finishReason: "stop",
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      },
    });

    expect(result.reasoningText).toBe("Checking KB first.");
    expect(result.isStreamingReasoning).toBe(false);
    expect(result.hasScratchpadWrite).toBe(true);
    expect(result.textContent).toBe("STATUS: DONE\n\nSummary here.");
    expect(result.isStreamingText).toBe(true);
    expect(result.toolSteps).toEqual([
      {
        toolCallId: "tc-1",
        toolName: "search_knowledge_base",
        args: { query: "MCP" },
        result: { chunks: ["chunk1"] },
        status: "complete",
      },
      {
        toolCallId: "tc-2",
        toolName: "scratchpad_write",
        args: { filePath: "mcp.md" },
        result: { success: true, filePath: "mcp.md" },
        status: "complete",
      },
      {
        toolCallId: "tc-3",
        toolName: "web_search",
        args: { q: "Maruf" },
        result: undefined,
        status: "calling",
      },
      {
        toolCallId: "tc-4",
        toolName: "broken_tool",
        args: {},
        result: { error: "Timeout" },
        status: "complete",
      },
    ]);
    expect(result.metadata).toEqual({
      modelId: "gpt-4o-mini",
      durationMs: 2400,
      stepCount: 3,
      maxSteps: 10,
      finishReason: "stop",
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
  });

  it("falls back gracefully for legacy string and empty results", () => {
    expect(parseSubagentResult("Legacy text output")).toEqual({
      reasoningText: "",
      isStreamingReasoning: false,
      toolSteps: [],
      textContent: "Legacy text output",
      isStreamingText: false,
      hasScratchpadWrite: false,
    });

    expect(parseSubagentResult(null)).toEqual({
      reasoningText: "",
      isStreamingReasoning: false,
      toolSteps: [],
      textContent: "",
      isStreamingText: false,
      hasScratchpadWrite: false,
    });

    expect(
      parseSubagentResult({
        id: "no-parts",
        metadata: { modelId: "gpt-4o" },
      }),
    ).toEqual({
      reasoningText: "",
      isStreamingReasoning: false,
      toolSteps: [],
      textContent: "Task completed.",
      isStreamingText: false,
      hasScratchpadWrite: false,
      metadata: { modelId: "gpt-4o" },
    });

    expect(parseSubagentResult({ id: "no-parts-no-meta" }).metadata).toBeUndefined();
  });

  it("handles non-object parts, streaming reasoning, and failed scratchpad_write", () => {
    const result = parseSubagentResult({
      parts: [
        null,
        { type: "reasoning", text: "Thinking...", state: "streaming" },
        { type: "text", text: "<think>only</think>", state: "done" },
        {
          type: "tool-legacy",
          state: "output-error",
          args: { a: 1 },
        },
        {
          type: "tool-empty",
          state: "input-available",
        },
        {
          type: "dynamic-tool",
          toolName: "scratchpad_write",
          toolCallId: "tc-fail",
          state: "output-available",
          input: {},
          output: { success: false },
        },
      ],
    });

    expect(result.isStreamingReasoning).toBe(true);
    expect(result.reasoningText).toBe("Thinking...");
    expect(result.textContent).toBe("");
    expect(result.isStreamingText).toBe(false);
    expect(result.toolSteps[0]).toEqual({
      toolCallId: "sub-tool-3",
      toolName: "legacy",
      args: { a: 1 },
      result: { error: "Tool execution failed" },
      status: "complete",
    });
    expect(result.hasScratchpadWrite).toBe(false);
  });
});
