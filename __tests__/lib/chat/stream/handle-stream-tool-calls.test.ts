import { describe, expect, it } from "vitest";
import { applyToolResultEvent } from "@/lib/chat/stream/apply-tool-result-event";
import { buildAssistantFinishMetadata } from "@/lib/chat/stream/build-assistant-finish-metadata";
import { extractCompletedToolResults } from "@/lib/chat/stream/extract-completed-tool-results";
import { applyToolCallEvent } from "@/lib/chat/stream/handle-stream-tool-calls";
import type { ToolCallState } from "@/types/tool/tool-call";

describe("handle-stream-tool-calls", () => {
  it("applies a tool-call event, deduplicating matching toolCallId", () => {
    const existing: ToolCallState[] = [
      {
        toolCallId: "tc-1",
        toolName: "test_tool",
        status: "calling",
      },
    ];

    const updated = applyToolCallEvent(existing, {
      type: "tool-call",
      toolCallId: "tc-1",
      toolName: "test_tool",
      args: { query: "new" },
      serverName: "ServerA",
    });

    expect(updated).toHaveLength(1);
    expect(updated[0]).toEqual({
      toolCallId: "tc-1",
      toolName: "test_tool",
      args: { query: "new" },
      serverName: "ServerA",
      status: "calling",
    });

    const appended = applyToolCallEvent(updated, {
      type: "tool-call",
      toolCallId: "tc-2",
      toolName: "another_tool",
      args: {},
    });

    expect(appended).toHaveLength(2);
    expect(appended[1].toolCallId).toBe("tc-2");
  });

  it("applies a tool-result event with preliminary or complete status", () => {
    const active: ToolCallState[] = [
      {
        toolCallId: "tc-1",
        toolName: "test_tool",
        status: "calling",
        serverName: "OrigServer",
      },
    ];

    const preliminary = applyToolResultEvent(active, {
      type: "tool-result",
      toolCallId: "tc-1",
      toolName: "test_tool",
      result: { partial: true },
      preliminary: true,
    });
    expect(preliminary[0].status).toBe("calling");
    expect(preliminary[0].result).toEqual({ partial: true });

    const complete = applyToolResultEvent(active, {
      type: "tool-result",
      toolCallId: "tc-1",
      toolName: "test_tool",
      result: "final output",
      serverName: "NewServer",
      preliminary: false,
    });
    expect(complete[0].status).toBe("complete");
    expect(complete[0].result).toBe("final output");
    expect(complete[0].serverName).toBe("NewServer");
  });

  it("extracts completed tool results", () => {
    const tools: ToolCallState[] = [
      { toolCallId: "1", toolName: "a", status: "complete", result: "res1" },
      { toolCallId: "2", toolName: "b", status: "complete", result: undefined },
      { toolCallId: "3", toolName: "c", status: "calling", result: "partial" },
    ];

    const extracted = extractCompletedToolResults(tools);
    expect(extracted).toEqual([
      { toolCallId: "1", toolName: "a", result: "res1" },
      { toolCallId: "3", toolName: "c", result: "partial" },
    ]);
  });

  it("extracts completed tool results with serverName when present", () => {
    const tools: ToolCallState[] = [
      {
        toolCallId: "1",
        toolName: "a",
        status: "complete",
        result: "res1",
        serverName: "mcp-srv",
      },
      {
        toolCallId: "2",
        toolName: "b",
        status: "complete",
        result: "res2",
      },
    ];

    const extracted = extractCompletedToolResults(tools);
    expect(extracted).toEqual([
      { toolCallId: "1", toolName: "a", result: "res1", serverName: "mcp-srv" },
      { toolCallId: "2", toolName: "b", result: "res2" },
    ]);
  });

  it("builds assistant finish metadata JSON correctly", () => {
    const metaStr = buildAssistantFinishMetadata({
      model: "gpt-4o",
      reasoning: "thought",
      completedTools: [
        { toolCallId: "tc-1", toolName: "toolA", status: "complete", args: { a: 1 } },
      ],
      toolResults: [
        { toolCallId: "tc-1", toolName: "toolA", result: "done" },
      ],
      usage: { promptTokens: 10 },
      finishReason: "stop",
      durationMs: 1200,
    });

    const parsed = JSON.parse(metaStr);
    expect(parsed).toEqual({
      model: "gpt-4o",
      reasoning: "thought",
      toolCalls: [{ toolCallId: "tc-1", toolName: "toolA", args: { a: 1 } }],
      toolResults: [{ toolCallId: "tc-1", toolName: "toolA", result: "done" }],
      usage: { promptTokens: 10 },
      finishReason: "stop",
      durationMs: 1200,
    });
  });
});

