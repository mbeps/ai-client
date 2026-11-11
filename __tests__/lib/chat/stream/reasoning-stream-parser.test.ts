import { describe, expect, it } from "vitest";
import {
  createInlineReasoningParser,
  createReasoningNormalizingFetch,
  extractReasoningFromDelta,
  transformChatCompletionRequestBody,
} from "@/lib/chat/stream/reasoning-stream-parser";

describe("createInlineReasoningParser", () => {
  it("extracts reasoning from standard <think>...</think> tags", () => {
    const parser = createInlineReasoningParser();

    const parts1 = parser.push("Introductory text <think>Let me calculate 2 + 2.</think>The answer is 4.");
    const parts2 = parser.flush();

    const all = [...parts1, ...parts2];
    expect(all).toEqual([
      { type: "text", text: "Introductory text " },
      { type: "reasoning", text: "Let me calculate 2 + 2." },
      { type: "text", text: "The answer is 4." },
    ]);
  });

  it("handles alternative tags: <thinking>, <thought>, <reasoning>, [THINK], ◁think▷", () => {
    const testCases = [
      {
        input: "<thinking>Thinking deeply</thinking>Final answer",
        reasoning: "Thinking deeply",
        text: "Final answer",
      },
      {
        input: "<thought>Pondering</thought>Result",
        reasoning: "Pondering",
        text: "Result",
      },
      {
        input: "<reasoning>Logic step</reasoning>Done",
        reasoning: "Logic step",
        text: "Done",
      },
      {
        input: "[THINK]Bracket thought[/THINK]Answer",
        reasoning: "Bracket thought",
        text: "Answer",
      },
      {
        input: "◁think▷Special delimiter◁/think▷Result",
        reasoning: "Special delimiter",
        text: "Result",
      },
    ];

    for (const tc of testCases) {
      const parser = createInlineReasoningParser();
      const res = [...parser.push(tc.input), ...parser.flush()];
      expect(res).toEqual([
        { type: "reasoning", text: tc.reasoning },
        { type: "text", text: tc.text },
      ]);
    }
  });

  it("handles split tags across chunks", () => {
    const parser = createInlineReasoningParser();

    // Opening tag split with leading text: "Leading text <th" then "ink>"
    const chunk1 = parser.push("Leading text <th");
    expect(chunk1).toEqual([{ type: "text", text: "Leading text " }]);

    const chunk2 = parser.push("ink>I am think");
    expect(chunk2).toEqual([{ type: "reasoning", text: "I am think" }]);

    // Closing tag split: "ing.</th" then "ink>Finished"
    const chunk3 = parser.push("ing.</th");
    expect(chunk3).toEqual([{ type: "reasoning", text: "ing." }]);

    const chunk4 = parser.push("ink>Finished");
    expect(chunk4).toEqual([{ type: "text", text: "Finished" }]);

    const flush = parser.flush();
    expect(flush).toEqual([]);
  });

  it("flushes unclosed reasoning tag on stream abort or completion", () => {
    const parser = createInlineReasoningParser();

    const parts1 = parser.push("<think>Still calculating the formula...");
    expect(parts1).toEqual([{ type: "reasoning", text: "Still calculating the formula..." }]);

    const parts2 = parser.flush();
    expect(parts2).toEqual([]);
  });

  it("flushes partial close tag as reasoning if stream ends mid-tag", () => {
    const parser = createInlineReasoningParser();
    const parts1 = parser.push("<think>Beginning thought </th");
    expect(parts1).toEqual([{ type: "reasoning", text: "Beginning thought " }]);
    const parts2 = parser.flush();
    expect(parts2).toEqual([{ type: "reasoning", text: "</th" }]);
  });

  it("handles close tag prefix arriving at start of chunk in reasoning mode", () => {
    const parser = createInlineReasoningParser();
    const parts1 = parser.push("<think>Thought content");
    expect(parts1).toEqual([{ type: "reasoning", text: "Thought content" }]);
    const parts2 = parser.push("</th");
    expect(parts2).toEqual([]);
    const parts3 = parser.push("ink>Final response");
    expect(parts3).toEqual([{ type: "text", text: "Final response" }]);
  });

  it("ignores <think> tags inside markdown code fences when in normal text mode", () => {
    const parser = createInlineReasoningParser();

    const text = "Here is an example:\n```xml\n<think>Sample tag</think>\n```\nHope that helps.";
    const parts = [...parser.push(text), ...parser.flush()];

    expect(parts.some((p) => p.type === "reasoning")).toBe(false);
    expect(parts.map((p) => p.text).join("")).toBe(text);
  });

  it("trims leading newline right after opening tag and closing tag", () => {
    const parser = createInlineReasoningParser();

    const text = "<think>\nLine 1 of thought\nLine 2\n</think>\nActual response text.";
    const parts = [...parser.push(text), ...parser.flush()];

    expect(parts).toEqual([
      { type: "reasoning", text: "Line 1 of thought\nLine 2\n" },
      { type: "text", text: "Actual response text." },
    ]);
  });

  it("flushes partial open tag prefix as text when stream ends before completion", () => {
    const parser = createInlineReasoningParser();
    const parts1 = parser.push("<th");
    expect(parts1).toEqual([]);
    const parts2 = parser.flush();
    expect(parts2).toEqual([{ type: "text", text: "<th" }]);
  });

  it("handles code fence transitions across multiple chunks", () => {
    const parser = createInlineReasoningParser();
    const chunk1 = parser.push("```typescript\nconsole.log('<think>test</think>');\n");
    expect(chunk1).toEqual([
      { type: "text", text: "```" },
      { type: "text", text: "typescript\nconsole.log('<think>test</think>');\n" },
    ]);
    const chunk2 = parser.push("```\nOut of fence");
    expect(chunk2).toEqual([
      { type: "text", text: "```" },
      { type: "text", text: "\nOut of fence" },
    ]);
  });

  it("handles multiple sequential distinct reasoning tags in one chunk", () => {
    const parser = createInlineReasoningParser();
    const text = "<think>first</think> intermediate <thought>second</thought> final";
    const parts = [...parser.push(text), ...parser.flush()];
    expect(parts).toEqual([
      { type: "reasoning", text: "first" },
      { type: "text", text: " intermediate " },
      { type: "reasoning", text: "second" },
      { type: "text", text: " final" },
    ]);
  });
});

describe("extractReasoningFromDelta", () => {
  it("extracts from delta.reasoning_content", () => {
    expect(extractReasoningFromDelta({ reasoning_content: "DeepSeek thought" })).toBe(
      "DeepSeek thought",
    );
  });

  it("extracts from delta.reasoning", () => {
    expect(extractReasoningFromDelta({ reasoning: "OpenRouter reasoning" })).toBe(
      "OpenRouter reasoning",
    );
  });

  it("extracts and joins from delta.reasoning_details array", () => {
    const delta = {
      reasoning_details: [
        { text: "First step." },
        { summary: "Second step." },
        {},
      ],
    };
    expect(extractReasoningFromDelta(delta)).toBe("First step.\nSecond step.");

    // Empty or non-text reasoning_details
    expect(extractReasoningFromDelta({ reasoning_details: [] })).toBeNull();
    expect(extractReasoningFromDelta({ reasoning_details: [{}] })).toBeNull();
  });

  it("returns null when no reasoning field is present", () => {
    expect(extractReasoningFromDelta({ content: "Hello" })).toBeNull();
    expect(extractReasoningFromDelta(null)).toBeNull();
    expect(extractReasoningFromDelta(undefined)).toBeNull();
  });
});

describe("transformChatCompletionRequestBody", () => {
  it("merges custom modelOptions without overwriting core params", () => {
    const body = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
    };
    const transformed = transformChatCompletionRequestBody(body, {
      modelOptions: { enable_thinking: true, temperature: 0.2 },
    });

    expect(transformed).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
      stream: true,
      enable_thinking: true,
      temperature: 0.2,
    });
  });

  it("formats openai reasoning_effort correctly", () => {
    const base = { model: "o1", messages: [] };

    // low / medium / high
    expect(
      transformChatCompletionRequestBody(base, {
        reasoningEffortFormat: "openai",
        reasoningEffort: "high",
      }),
    ).toEqual({ model: "o1", messages: [], reasoning_effort: "high" });

    // off -> omits reasoning_effort
    const offTransformed = transformChatCompletionRequestBody(
      { ...base, reasoning_effort: "medium" },
      { reasoningEffortFormat: "openai", reasoningEffort: "off" },
    );
    expect(offTransformed.reasoning_effort).toBeUndefined();
  });

  it("formats openrouter reasoning.effort correctly", () => {
    const base = { model: "anthropic/claude-3.7", messages: [] };

    expect(
      transformChatCompletionRequestBody(base, {
        reasoningEffortFormat: "openrouter",
        reasoningEffort: "medium",
      }),
    ).toEqual({
      model: "anthropic/claude-3.7",
      messages: [],
      reasoning: { effort: "medium" },
    });

    expect(
      transformChatCompletionRequestBody(base, {
        reasoningEffortFormat: "openrouter",
        reasoningEffort: "off",
      }),
    ).toEqual({
      model: "anthropic/claude-3.7",
      messages: [],
      reasoning: { enabled: false },
    });
  });

  it("formats anthropic thinking budget_tokens correctly", () => {
    const base = { model: "claude-3-7-sonnet", messages: [] };

    expect(
      transformChatCompletionRequestBody(base, {
        reasoningEffortFormat: "anthropic",
        reasoningEffort: "low",
      }),
    ).toEqual({
      model: "claude-3-7-sonnet",
      messages: [],
      thinking: { type: "enabled", budget_tokens: 1024 },
    });

    expect(
      transformChatCompletionRequestBody(base, {
        reasoningEffortFormat: "anthropic",
        reasoningEffort: "off",
      }),
    ).toEqual({
      model: "claude-3-7-sonnet",
      messages: [],
      thinking: { type: "disabled" },
    });
  });
});

describe("createReasoningNormalizingFetch", () => {
  it("normalizes SSE stream with reasoning_content into <think> tags", async () => {
    const sseChunks = [
      'data: {"choices":[{"index":0,"delta":{"role":"assistant","reasoning_content":"Step 1"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"reasoning_content":" and 2."}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"Answer"}}]}\n\n',
      "data: [DONE]\n\n",
    ].join("");

    const mockFetch = async () =>
      new Response(sseChunks, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    const customFetch = createReasoningNormalizingFetch({
      baseFetch: mockFetch,
    });

    const res = await customFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "deepseek-r1" }),
    });

    const text = await res.text();
    expect(text).toContain("<think>");
    expect(text).toContain("Step 1");
    expect(text).toContain(" and 2.");
    expect(text).toContain("</think>");
    expect(text).toContain("Answer");
  });

  it("passes through subsequent SSE text deltas after reasoning has closed", async () => {
    const sseChunks = [
      'data: {"choices":[{"index":0,"delta":{"reasoning_content":"Step 1"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"Answer part 1"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":" and part 2"}}]}\n\n',
      "data: [DONE]\n\n",
    ].join("");

    const mockFetch = async () =>
      new Response(sseChunks, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    const customFetch = createReasoningNormalizingFetch({
      baseFetch: mockFetch,
    });

    const res = await customFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "deepseek-r1" }),
    });

    const text = await res.text();
    expect(text).toContain("<think>");
    expect(text).toContain("Step 1");
    expect(text).toContain("</think>");
    expect(text).toContain("Answer part 1");
    expect(text).toContain(" and part 2");
  });

  it("catches text reading errors for application/json responses and returns raw response", async () => {
    const mockResponse = {
      ok: true,
      body: {} as ReadableStream,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "Content-Type": "application/json" }),
      text: () => Promise.reject(new Error("Network error reading body")),
    } as unknown as Response;

    const customFetch = createReasoningNormalizingFetch({
      baseFetch: async () => mockResponse,
    });

    const res = await customFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "test" }),
    });

    expect(res).toBe(mockResponse);
  });

  it("reads and strips x-ai-client-reasoning-effort header before calling baseFetch", async () => {
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: Record<string, unknown> = {};

    const mockFetch = async (_url: any, init: any) => {
      capturedHeaders = init?.headers ?? {};
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const customFetch = createReasoningNormalizingFetch({
      reasoningEffortFormat: "openai",
      baseFetch: mockFetch,
    });

    await customFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-client-reasoning-effort": "high",
      },
      body: JSON.stringify({ model: "o3-mini" }),
    });

    expect(capturedHeaders["x-ai-client-reasoning-effort"]).toBeUndefined();
    expect(capturedBody.reasoning_effort).toBe("high");
  });

  it("ignores invalid x-ai-client-reasoning-effort header values", async () => {
    let capturedBody: Record<string, unknown> = {};

    const mockFetch = async (_url: any, init: any) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const customFetch = createReasoningNormalizingFetch({
      reasoningEffortFormat: "openai",
      reasoningEffort: "low",
      baseFetch: mockFetch,
    });

    await customFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "x-ai-client-reasoning-effort": "invalid-level",
      },
      body: JSON.stringify({ model: "o3-mini" }),
    });

    // Kept default "low" because "invalid-level" is ignored
    expect(capturedBody.reasoning_effort).toBe("low");
  });

  it("handles responses with no content-type and SSE comments/empty blocks", async () => {
    const sseChunks = [
      ": ping\n\n\n\n",
      'data: {"choices":[{"index":0,"delta":{"content":"Hi"}}]}\n\n',
      "data: [DONE]\n\n",
    ].join("");

    const mockFetch = async () =>
      new Response(sseChunks, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    const customFetch = createReasoningNormalizingFetch({
      baseFetch: mockFetch,
    });

    const res = await customFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "test" }),
    });

    const text = await res.text();
    expect(text).toContain(": ping");
    expect(text).toContain("Hi");

    // Also test response without content-type header
    const noContentTypeFetch = createReasoningNormalizingFetch({
      baseFetch: async () =>
        new Response(new ReadableStream(), {
          status: 200,
          headers: new Headers(),
        }),
    });
    const plainRes = await noContentTypeFetch("https://api.openai.com/v1/chat/completions");
    expect(plainRes.status).toBe(200);
  });

  it("handles non-OK or body-less responses gracefully", async () => {
    const mockFetch = async () => new Response(null, { status: 500 });
    const customFetch = createReasoningNormalizingFetch({ baseFetch: mockFetch });
    const res = await customFetch("https://api.openai.com/v1/chat/completions");
    expect(res.status).toBe(500);
  });

  it("leaves invalid JSON request body intact", async () => {
    let capturedBody = "";
    const mockFetch = async (_url: any, init: any) => {
      capturedBody = init?.body as string;
      return new Response("ok", { status: 200 });
    };
    const customFetch = createReasoningNormalizingFetch({
      reasoningEffort: "high",
      baseFetch: mockFetch,
    });
    await customFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: "{ not valid json",
    });
    expect(capturedBody).toBe("{ not valid json");
  });

  it("normalizes application/json responses with reasoning", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: "Final answer",
                reasoning_content: "My thoughts",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

    const customFetch = createReasoningNormalizingFetch({ baseFetch: mockFetch });
    const res = await customFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
    });
    const data = await res.json();
    expect(data.choices[0].message.content).toBe("<think>My thoughts</think>\nFinal answer");
  });

  it("skips <think> injection on application/json responses when request sets response_format", async () => {
    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: '{"ok":true}',
                reasoning: "Let me format this JSON properly",
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );

    const customFetch = createReasoningNormalizingFetch({ baseFetch: mockFetch });
    const res = await customFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "openrouter/free",
        response_format: { type: "json_schema", json_schema: { name: "test", schema: {} } },
      }),
    });
    const data = await res.json();
    expect(data.choices[0].message.content).toBe('{"ok":true}');
  });

  it("handles application/json responses that fail parsing", async () => {
    const mockFetch = async () =>
      new Response("not json", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const customFetch = createReasoningNormalizingFetch({ baseFetch: mockFetch });
    const res = await customFetch("https://api.openai.com/v1/chat/completions");
    expect(await res.text()).toBe("not json");
  });

  it("handles SSE streams ending or receiving [DONE] while reasoning is open", async () => {
    const sse = [
      ': ping\n\n',
      'data: not-json\n\n',
      'data: {"choices":[{"index":0,"delta":{"reasoning":"Thought without close"}}]}\n\n',
      'data: [DONE]\n\n',
    ].join("");

    const mockFetch = async () =>
      new Response(sse, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    const customFetch = createReasoningNormalizingFetch({ baseFetch: mockFetch });
    const res = await customFetch("https://api.openai.com/v1/chat/completions");
    const text = await res.text();
    expect(text).toContain("<think>Thought without close");
    expect(text).toContain("</think>");
  });

  it("handles SSE cancelation", async () => {
    const sse = 'data: {"choices":[{"index":0,"delta":{"reasoning":"Thinking..."}}]}\n\n';
    let canceled = false;
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(sse));
      },
      cancel() {
        canceled = true;
      },
    });

    const mockFetch = async () =>
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });

    const customFetch = createReasoningNormalizingFetch({ baseFetch: mockFetch });
    const res = await customFetch("https://api.openai.com/v1/chat/completions");
    const reader = res.body?.getReader();
    await reader?.read();
    await reader?.cancel("user stopped");
    expect(canceled).toBe(true);
  });
});
