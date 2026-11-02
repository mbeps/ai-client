import { describe, expect, it } from "vitest";
import { buildAssistantFinishMetadata } from "@/lib/chat/stream/build-assistant-finish-metadata";

describe("buildAssistantFinishMetadata", () => {
  it("serializes finish metadata with stopped flag when provided", () => {
    const json = buildAssistantFinishMetadata({
      model: "claude-3-7-sonnet",
      reasoning: "step by step",
      completedTools: [
        {
          toolCallId: "tc-1",
          toolName: "web_search",
          args: { query: "weather" },
          result: { temp: 20 },
        },
      ],
      usage: { totalTokens: 150 },
      finishReason: "stop",
      durationMs: 1200,
      stopped: true,
    });

    const parsed = JSON.parse(json);
    expect(parsed).toEqual({
      model: "claude-3-7-sonnet",
      reasoning: "step by step",
      toolCalls: [{ toolCallId: "tc-1", toolName: "web_search", args: { query: "weather" } }],
      toolResults: [{ toolCallId: "tc-1", toolName: "web_search", result: { temp: 20 } }],
      usage: { totalTokens: 150 },
      finishReason: "stop",
      durationMs: 1200,
      stopped: true,
    });
  });

  it("omits stopped field when undefined", () => {
    const json = buildAssistantFinishMetadata({
      model: "gpt-4o",
      reasoning: "",
      completedTools: [],
    });

    const parsed = JSON.parse(json);
    expect(parsed.stopped).toBeUndefined();
    expect(parsed.durationMs).toBeUndefined();
    expect(parsed.model).toBe("gpt-4o");
  });

  it("includes stopped: false when explicitly provided as false", () => {
    const json = buildAssistantFinishMetadata({
      model: "gpt-4o",
      reasoning: "",
      completedTools: [],
      stopped: false,
    });

    const parsed = JSON.parse(json);
    expect(parsed.stopped).toBe(false);
  });

  it("preserves serverName on toolCalls and toolResults when present", () => {
    const json = buildAssistantFinishMetadata({
      model: "gpt-4o",
      reasoning: "",
      completedTools: [
        {
          toolCallId: "tc-mcp-1",
          toolName: "fetch_data",
          args: { id: "123" },
          result: { ok: true },
          serverName: "my-mcp-server",
        },
      ],
    });

    const parsed = JSON.parse(json);
    expect(parsed.toolCalls).toEqual([
      {
        toolCallId: "tc-mcp-1",
        toolName: "fetch_data",
        args: { id: "123" },
        serverName: "my-mcp-server",
      },
    ]);
    expect(parsed.toolResults).toEqual([
      {
        toolCallId: "tc-mcp-1",
        toolName: "fetch_data",
        result: { ok: true },
        serverName: "my-mcp-server",
      },
    ]);
  });

  it("substitutes interrupted error when tool result is undefined", () => {
    const json = buildAssistantFinishMetadata({
      model: "gpt-4o",
      reasoning: "thinking",
      completedTools: [
        {
          toolCallId: "tc-interrupted",
          toolName: "slow_tool",
          args: { timeout: 10 },
          result: undefined,
        },
      ],
    });

    const parsed = JSON.parse(json);
    expect(parsed.toolResults[0]).toEqual({
      toolCallId: "tc-interrupted",
      toolName: "slow_tool",
      result: { error: "Tool execution was interrupted" },
    });
  });
});
