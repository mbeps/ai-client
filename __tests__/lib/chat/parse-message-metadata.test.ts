import { describe, expect, it, vi } from "vitest";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";

const mockLog = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: vi.fn(() => mockLog),
  logger: mockLog,
}));

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
      selectedSkillIds: null,
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

  it("uses a non-string metadata value as-is instead of JSON-parsing it", () => {
    // Runtime guard: the declared type is `string | null | undefined`, but the
    // `typeof metadata === "string"` ternary has a live non-string arm. If it
    // were removed, JSON.parse would coerce the object to "[object Object]"
    // and throw, yielding the empty defaults.
    const result = parseMessageMetadata({
      model: "gpt-5",
    } as unknown as string);

    expect(result.modelId).toBe("gpt-5");
  });

  it("builds promptMeta only when both promptId and userContent are strings", () => {
    const both = parseMessageMetadata(
      JSON.stringify({ promptId: "p-1", userContent: "Summarise this" }),
    );
    expect(both.promptMeta).toEqual({
      promptId: "p-1",
      promptIds: ["p-1"],
      userContent: "Summarise this",
    });

    // Multiple promptIds array parsing
    const multi = parseMessageMetadata(
      JSON.stringify({
        promptIds: ["p-1", "p-2"],
        userContent: "Summarise this",
      }),
    );
    expect(multi.promptMeta).toEqual({
      promptId: "p-1",
      promptIds: ["p-1", "p-2"],
      userContent: "Summarise this",
    });

    // promptId is a string but userContent is not, so the guard must fail.
    const partial = parseMessageMetadata(
      JSON.stringify({ promptId: "p-1", userContent: 42 }),
    );
    expect(partial.promptMeta).toBeNull();
  });

  it("returns toolData with an empty toolResults array when toolResults is not an array", () => {
    const result = parseMessageMetadata(
      JSON.stringify({
        toolCalls: [{ toolCallId: "tc-1", toolName: "search_web" }],
        toolResults: "not-an-array",
      }),
    );

    expect(result.toolData).toEqual({
      toolCalls: [{ toolCallId: "tc-1", toolName: "search_web" }],
      toolResults: [],
    });
  });

  it("passes through toolResults untouched when it is an array", () => {
    const toolCalls = [{ toolCallId: "tc-1", toolName: "search_web" }];
    const toolResults = [{ toolCallId: "tc-1", output: "a result" }];

    const result = parseMessageMetadata(
      JSON.stringify({ toolCalls, toolResults }),
    );

    expect(result.toolData).toEqual({ toolCalls, toolResults });
  });

  it("returns null toolData when toolCalls is an empty array", () => {
    const result = parseMessageMetadata(
      JSON.stringify({ toolCalls: [], toolResults: [{ toolCallId: "tc-1" }] }),
    );

    expect(result.toolData).toBeNull();
  });

  it("returns null for every field when no recognised keys are present", () => {
    const result = parseMessageMetadata(JSON.stringify({ unrelated: true }));

    expect(result.promptMeta).toBeNull();
    expect(result.toolData).toBeNull();
    expect(result.modelId).toBeNull();
    expect(result.selectedServerIds).toBeNull();
    expect(result.selectedTools).toBeNull();
    expect(result.selectedKbIds).toBeNull();
    expect(result.reasoning).toBeUndefined();
    expect(result.finishReason).toBeNull();
    expect(result.durationMs).toBeNull();
  });

  it("reads selection arrays, reasoning, finishReason and durationMs when present", () => {
    const result = parseMessageMetadata(
      JSON.stringify({
        selectedServerIds: ["srv-1", "srv-2"],
        selectedTools: ["manage_artifact", "search_web"],
        selectedKbIds: ["kb-1"],
        reasoning: "The user wants a diagram.",
        finishReason: "length",
        durationMs: 87,
      }),
    );

    expect(result.selectedServerIds).toEqual(["srv-1", "srv-2"]);
    expect(result.selectedTools).toEqual(["manage_artifact", "search_web"]);
    expect(result.selectedKbIds).toEqual(["kb-1"]);
    expect(result.reasoning).toBe("The user wants a diagram.");
    expect(result.finishReason).toBe("length");
    expect(result.durationMs).toBe(87);
  });

  it("sums prompt and completion tokens when totalTokens is absent", () => {
    const result = parseMessageMetadata(
      JSON.stringify({
        usage: { promptTokens: 30, completionTokens: 12 },
      }),
    );

    expect(result.usage).toEqual({
      promptTokens: 30,
      completionTokens: 12,
      totalTokens: 42,
    });
  });

  it("reads legacy inputTokens and outputTokens field names", () => {
    const result = parseMessageMetadata(
      JSON.stringify({
        usage: { inputTokens: 11, outputTokens: 9 },
      }),
    );

    expect(result.usage).toEqual({
      promptTokens: 11,
      completionTokens: 9,
      totalTokens: 20,
    });
  });

  it("treats a missing completion count as zero when summing totals", () => {
    const result = parseMessageMetadata(
      JSON.stringify({ usage: { promptTokens: 30 } }),
    );

    expect(result.usage).toEqual({
      promptTokens: 30,
      completionTokens: undefined,
      totalTokens: 30,
    });
  });

  it("treats a missing prompt count as zero when summing totals", () => {
    const result = parseMessageMetadata(
      JSON.stringify({ usage: { completionTokens: 12 } }),
    );

    expect(result.usage).toEqual({
      promptTokens: undefined,
      completionTokens: 12,
      totalTokens: 12,
    });
  });

  it("leaves every token undefined for an empty usage object", () => {
    const result = parseMessageMetadata(JSON.stringify({ usage: {} }));

    // usage is an object, so a usage object is still returned, but with no
    // counts and no derivable total.
    expect(result.usage).toEqual({
      promptTokens: undefined,
      completionTokens: undefined,
      totalTokens: undefined,
    });
  });

  it("returns null usage when usage is a truthy non-object", () => {
    const result = parseMessageMetadata(JSON.stringify({ usage: "many-tokens" }));

    expect(result.usage).toBeNull();
  });

  it("logs the stringified throwable and returns defaults on a non-Error throw", () => {
    vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw "explode";
    });

    const result = parseMessageMetadata("{valid-looking}");

    // A non-Error throwable has no .message, so String(e) is used instead.
    expect(mockLog.error).toHaveBeenCalledWith(
      "Failed to parse message metadata: {error}",
      { error: "explode" },
    );
    expect(result).toEqual({
      promptMeta: null,
      toolData: null,
      modelId: null,
      selectedServerIds: null,
      selectedTools: null,
      selectedKbIds: null,
      selectedSkillIds: null,
      reasoning: undefined,
      usage: null,
      finishReason: null,
      durationMs: null,
    });

    vi.restoreAllMocks();
  });

  it("logs the Error message rather than the stringified error on a JSON syntax error", () => {
    const result = parseMessageMetadata("{oops");

    expect(mockLog.error).toHaveBeenCalledWith(
      "Failed to parse message metadata: {error}",
      expect.objectContaining({ error: expect.any(String) }),
    );
    expect(result.modelId).toBeNull();
  });
});
