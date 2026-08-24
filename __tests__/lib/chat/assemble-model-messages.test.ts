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
});
