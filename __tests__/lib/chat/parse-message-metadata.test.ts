import { describe, it, expect } from "vitest";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";

describe("parseMessageMetadata", () => {
  it("returns default values when metadata is null or undefined", () => {
    const result = parseMessageMetadata(null);
    expect(result).toEqual({
      promptMeta: null,
      toolData: null,
      modelId: null,
      selectedServerIds: null,
      selectedTools: null,
      selectedKbIds: null,
      reasoning: undefined,
      usage: null,
      finishReason: null,
      durationMs: null,
    });
  });

  it("parses model, usage, finishReason, and durationMs from JSON", () => {
    const raw = JSON.stringify({
      model: "claude-3-5-sonnet",
      finishReason: "stop",
      durationMs: 1420,
      usage: {
        promptTokens: 50,
        completionTokens: 100,
        totalTokens: 150,
      },
    });

    const result = parseMessageMetadata(raw);
    expect(result.modelId).toBe("claude-3-5-sonnet");
    expect(result.finishReason).toBe("stop");
    expect(result.durationMs).toBe(1420);
    expect(result.usage).toEqual({
      promptTokens: 50,
      completionTokens: 100,
      totalTokens: 150,
    });
  });

  it("handles legacy metadata without usage or timing data", () => {
    const raw = JSON.stringify({
      model: "gpt-4",
    });

    const result = parseMessageMetadata(raw);
    expect(result.modelId).toBe("gpt-4");
    expect(result.usage).toBeNull();
    expect(result.finishReason).toBeNull();
    expect(result.durationMs).toBeNull();
  });

  it("handles malformed JSON gracefully without throwing", () => {
    const result = parseMessageMetadata("not-valid-json{");
    expect(result.modelId).toBeNull();
    expect(result.usage).toBeNull();
  });
});
