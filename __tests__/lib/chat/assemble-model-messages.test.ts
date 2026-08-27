import { describe, it, expect } from "vitest";
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
    expect(messages).toHaveLength(1);
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
});
