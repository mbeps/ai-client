// Dual export shape per .agents/testing.md. The metadata catch block only
// reports through the logger, so the log is how a non-Error throwable is
// distinguished from an Error one.
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

import { describe, expect, it, vi } from "vitest";
import { assembleModelMessages } from "@/lib/chat/assemble-model-messages";

describe("assembleModelMessages — tool results (T10.4)", () => {
  it("emits tool-result parts with canonical output and no legacy result field", () => {
    const messages = assembleModelMessages([
      {
        role: "assistant",
        content: "",
        metadata: JSON.stringify({
          toolCalls: [{ toolCallId: "t1", toolName: "search", args: "{}" }],
          toolResults: [
            { toolCallId: "t1", toolName: "search", result: '{"hits":[]}' },
          ],
        }),
      },
    ]);

    const toolMsg = messages.find((m) => m.role === "tool") as {
      content: Array<{ type: string; output?: unknown; result?: unknown }>;
    };
    expect(toolMsg).toBeDefined();
    const part = toolMsg.content[0];
    expect(part.type).toBe("tool-result");
    expect(part.output).toEqual({ type: "json", value: { hits: [] } });
    expect(part.result).toBeUndefined();
  });

  it("filters out system messages to avoid InvalidPromptError in AI SDK v7", () => {
    const messages = assembleModelMessages([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: "user", content: "Hello" });
  });

  it("sets input property on tool-call parts for AI SDK v7 provider serialization", () => {
    const messages = assembleModelMessages([
      {
        role: "assistant",
        content: "I will manage the artifact.",
        metadata: JSON.stringify({
          toolCalls: [
            {
              toolCallId: "call_123",
              toolName: "manage_artifact",
              args: { action: "create", title: "Report" },
            },
          ],
        }),
      },
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe("tool");
    const parts = (messages[0] as any).content;
    const toolCallPart = parts.find((p: any) => p.type === "tool-call");
    expect(toolCallPart).toBeDefined();
    expect(toolCallPart.input).toEqual({ action: "create", title: "Report" });
    expect(toolCallPart.toolName).toBe("manage_artifact");
  });

  it("safely handles non-JSON plain text tool results without throwing or discarding history", () => {
    const messages = assembleModelMessages([
      {
        role: "assistant",
        content: "Calling tool",
        metadata: JSON.stringify({
          toolCalls: [
            {
              toolCallId: "call_123",
              toolName: "lookup",
              args: { query: "test" },
            },
          ],
          toolResults: [
            {
              toolCallId: "call_123",
              toolName: "lookup",
              result: "Plain text error: file not found",
            },
          ],
        }),
      },
    ]);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("assistant");
    expect(messages[1].role).toBe("tool");
    const toolResults = (messages[1] as any).content;
    expect(toolResults[0].output).toEqual({
      type: "text",
      value: "Plain text error: file not found",
    });
  });

  it("handles user messages with document, non-image, and image attachments", () => {
    const messages = assembleModelMessages([
      {
        role: "user",
        content: "Analyze these files",
        attachments: [
          {
            id: "att-1",
            name: "doc.txt",
            type: "document",
            extractedText: "Extracted document text",
          },
          {
            id: "att-2",
            name: "data.xlsx",
            type: "spreadsheet",
          },
          {
            id: "att-3",
            name: "pic.png",
            type: "image",
            url: "https://example.com/pic.png",
            mimeType: "image/png",
          },
        ] as any,
      },
    ]);

    expect(messages).toHaveLength(1);
    const content = messages[0].content as any[];
    expect(Array.isArray(content)).toBe(true);
    expect(content.some((p) => p.type === "text" && p.text.includes("Extracted document text"))).toBe(true);
    expect(content.some((p) => p.type === "text" && p.text.includes("[Attached File: data.xlsx (spreadsheet)]"))).toBe(true);
    expect(content.some((p) => p.type === "text" && p.text === "Analyze these files")).toBe(true);
    expect(content.some((p) => p.type === "file" && p.data.url === "https://example.com/pic.png")).toBe(true);
  });

  it("handles user message with single text part as string content", () => {
    const messages = assembleModelMessages([
      {
        role: "user",
        content: "",
        attachments: [
          {
            id: "att-1",
            name: "only-doc.txt",
            type: "document",
            extractedText: "Only doc text",
          },
        ] as any,
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("[Document: only-doc.txt]\nOnly doc text");
  });

  it("falls back to raw message when metadata JSON is corrupted", () => {
    const messages = assembleModelMessages([
      {
        role: "assistant",
        content: "Original assistant message",
        metadata: "{invalid json",
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      role: "assistant",
      content: "Original assistant message",
    });
  });

  it("handles unparseable tool call args string and tool output field", () => {
    const messages = assembleModelMessages([
      {
        role: "assistant",
        content: "Tool execution",
        metadata: JSON.stringify({
          toolCalls: [{ toolCallId: "tc-1", toolName: "t1", args: "{not-json" }],
          toolResults: [{ toolCallId: "tc-1", toolName: "t1", output: '{"status":"ok"}' }],
        }),
      },
    ]);
    expect(messages).toHaveLength(2);
  });

  it("heals when toolResults is missing or empty by synthesizing fallback result parts for all tool calls", () => {
    const messagesWithMissingResults = assembleModelMessages([
      {
        role: "assistant",
        content: "Searching...",
        metadata: JSON.stringify({
          toolCalls: [
            { toolCallId: "call_1", toolName: "search", args: { q: "test" } },
            { toolCallId: "call_2", toolName: "lookup", args: { id: "123" } },
          ],
        }),
      },
    ]);

    expect(messagesWithMissingResults).toHaveLength(2);
    expect(messagesWithMissingResults[1].role).toBe("tool");
    const resultParts = (messagesWithMissingResults[1] as any).content;
    expect(resultParts).toHaveLength(2);
    expect(resultParts[0]).toEqual({
      type: "tool-result",
      toolCallId: "call_1",
      toolName: "search",
      output: { type: "json", value: { error: "Tool execution did not return a result" } },
    });
    expect(resultParts[1]).toEqual({
      type: "tool-result",
      toolCallId: "call_2",
      toolName: "lookup",
      output: { type: "json", value: { error: "Tool execution did not return a result" } },
    });

    const messagesWithEmptyResults = assembleModelMessages([
      {
        role: "assistant",
        content: "Searching...",
        metadata: JSON.stringify({
          toolCalls: [
            { toolCallId: "call_1", toolName: "search", args: { q: "test" } },
          ],
          toolResults: [],
        }),
      },
    ]);

    expect(messagesWithEmptyResults).toHaveLength(2);
    const emptyResultParts = (messagesWithEmptyResults[1] as any).content;
    expect(emptyResultParts).toHaveLength(1);
    expect(emptyResultParts[0].output).toEqual({
      type: "json",
      value: { error: "Tool execution did not return a result" },
    });
  });

  it("handles partially missing tool results by using matching result when available and fallback for missing", () => {
    const messages = assembleModelMessages([
      {
        role: "assistant",
        content: "Searching and fetching...",
        metadata: JSON.stringify({
          toolCalls: [
            { toolCallId: "call_1", toolName: "search", args: { q: "test" } },
            { toolCallId: "call_2", toolName: "fetch_url", args: { url: "https://example.com" } },
          ],
          toolResults: [
            {
              toolCallId: "call_1",
              toolName: "search",
              result: { hits: ["doc1", "doc2"] },
            },
          ],
        }),
      },
    ]);

    expect(messages).toHaveLength(2);
    expect(messages[1].role).toBe("tool");
    const parts = (messages[1] as any).content;
    expect(parts).toHaveLength(2);

    expect(parts[0]).toEqual({
      type: "tool-result",
      toolCallId: "call_1",
      toolName: "search",
      output: { type: "json", value: { hits: ["doc1", "doc2"] } },
    });

    expect(parts[1]).toEqual({
      type: "tool-result",
      toolCallId: "call_2",
      toolName: "fetch_url",
      output: {
        type: "json",
        value: { error: "Tool execution did not return a result" },
      },
    });
  });

  it("defaults an image attachment's mediaType to image when mimeType is absent", () => {
    const messages = assembleModelMessages([
      {
        role: "user",
        content: "look",
        attachments: [
          {
            id: "att-1",
            name: "shot",
            type: "image",
            url: "https://example.com/shot",
            // mimeType deliberately absent
          },
        ] as any,
      },
    ]);

    const parts = messages[0].content as any[];
    const filePart = parts.find((p) => p.type === "file");
    expect(filePart.mediaType).toBe("image");
    expect(filePart.data).toEqual({
      type: "url",
      url: "https://example.com/shot",
    });
  });

  it("falls back to the legacy `input` field when a tool call carries only that", () => {
    const messages = assembleModelMessages([
      {
        role: "assistant",
        content: "",
        metadata: JSON.stringify({
          toolCalls: [
            {
              toolCallId: "call_1",
              toolName: "legacy_tool",
              // `args` absent; only the legacy `input` key is present
              input: { legacy: true },
            },
          ],
          toolResults: [
            { toolCallId: "call_1", toolName: "legacy_tool", result: { ok: 1 } },
          ],
        }),
      },
    ]);

    const toolCallPart = (messages[0] as any).content.find(
      (p: any) => p.type === "tool-call",
    );
    expect(toolCallPart.input).toEqual({ legacy: true });
    expect(toolCallPart.args).toEqual({ legacy: true });
  });

  it("emits an empty text value when a matched tool result is nullish", () => {
    const messages = assembleModelMessages([
      {
        role: "assistant",
        content: "",
        metadata: JSON.stringify({
          toolCalls: [{ toolCallId: "call_1", toolName: "void_tool", args: {} }],
          toolResults: [
            // result is explicitly null: it is neither undefined nor an object,
            // so it survives the `.result ?? .output` selection as null.
            { toolCallId: "call_1", toolName: "void_tool", result: null },
          ],
        }),
      },
    ]);

    const part = (messages[1] as any).content[0];
    // Asserts the `raw ?? ""` fallback specifically: String(null) would be
    // "null", so this can only be the empty-string arm.
    expect(part.output).toEqual({ type: "text", value: "" });
  });

  it("logs a stringified non-Error throwable when metadata coercion fails", () => {
    const hostileMetadata = {
      toString() {
        // JSON.parse coerces its input, so a throwing toString escapes as a
        // plain string rather than a SyntaxError.
        throw "metadata exploded";
      },
    } as unknown as string;

    const messages = assembleModelMessages([
      {
        role: "assistant",
        content: "Original assistant message",
        metadata: hostileMetadata,
      },
    ]);

    expect(mockLog.warn).toHaveBeenCalledWith(
      "Failed to parse metadata for history: {error}",
      { error: "metadata exploded" },
    );
    // The message must survive the failed parse rather than being dropped.
    expect(messages).toEqual([
      { role: "assistant", content: "Original assistant message" },
    ]);
  });

  it("logs the Error message when metadata is invalid JSON", () => {
    assembleModelMessages([
      {
        role: "assistant",
        content: "fallback",
        metadata: "{not json",
      },
    ]);

    // Pins the Error arm of the same ternary.
    expect(mockLog.warn).toHaveBeenCalledWith(
      "Failed to parse metadata for history: {error}",
      expect.objectContaining({
        error: expect.any(String),
      }),
    );
    const logged = mockLog.warn.mock.calls[0][1] as { error: string };
    expect(logged.error).toContain("JSON");
  });
});
