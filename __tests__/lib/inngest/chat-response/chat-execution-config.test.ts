import { describe, expect, it, vi } from "vitest";
import { buildStreamExecutionConfig } from "@/lib/inngest/chat-response/chat-execution-config";

describe("buildStreamExecutionConfig", () => {
  const fakeChatMethod = vi.fn((modelId: string) => `model:${modelId}`);
  const fakeResolved = {
    sdkProvider: {
      chat: fakeChatMethod,
    },
  };

  it("builds stream execution config without reasoning headers when effort is omitted", () => {
    const config = buildStreamExecutionConfig({
      resolved: fakeResolved,
      resolvedModelId: "gpt-4o",
      abortSignal: new AbortController().signal,
      systemPrompt: "You are helpful",
      finalMessages: [],
      hasAnyTools: false,
      maxSteps: 10,
    });

    expect(config.model).toBe("model:gpt-4o");
    expect(config.headers).toBeUndefined();
    expect(config.instructions).toBe("You are helpful");
    expect(config.tools).toBeUndefined();
    expect(config.stopWhen).toBeUndefined();
  });

  it("injects x-ai-client-reasoning-effort header when reasoningEffort is provided", () => {
    const config = buildStreamExecutionConfig({
      resolved: fakeResolved,
      resolvedModelId: "o3-mini",
      abortSignal: new AbortController().signal,
      systemPrompt: "Think carefully",
      finalMessages: [],
      hasAnyTools: true,
      allTools: { some_tool: {} },
      maxSteps: 15,
      reasoningEffort: "high",
    });

    expect(config.model).toBe("model:o3-mini");
    expect(config.headers).toEqual({
      "x-ai-client-reasoning-effort": "high",
    });
    expect(config.tools).toEqual({ some_tool: {} });
    expect(config.stopWhen).toBeDefined();
  });
});
