import type {
  ReasoningEffort,
  ReasoningEffortFormat,
} from "@/schemas/providers/provider-registry";

/**
 * Supported delimiter pairs for inline thinking and reasoning extraction.
 *
 * @author Maruf Bepary
 */
export const REASONING_DELIMITER_PAIRS = [
  { open: "<think>", close: "</think>" },
  { open: "<thinking>", close: "</thinking>" },
  { open: "<thought>", close: "</thought>" },
  { open: "<reasoning>", close: "</reasoning>" },
  { open: "[THINK]", close: "[/THINK]" },
  { open: "◁think▷", close: "◁/think▷" },
] as const;

/**
 * Token budget mapping for Anthropic / LiteLLM thinking format.
 *
 * @author Maruf Bepary
 */
export const ANTHROPIC_BUDGET_TOKENS: Record<
  Exclude<ReasoningEffort, "off">,
  number
> = {
  low: 1024,
  medium: 4096,
  high: 16384,
};

/**
 * Parsed stream part emitted by the inline reasoning parser.
 *
 * @author Maruf Bepary
 */
export type StreamContentPart = {
  type: "text" | "reasoning";
  text: string;
};

/**
 * Checks if a suffix of `text` is a prefix of any given tag string.
 *
 * @param text - Text buffer to inspect
 * @param tags - Candidate tag strings
 * @returns Starting index of the potential tag prefix, or null
 * @author Maruf Bepary
 */
function findPotentialTagPrefix(
  text: string,
  tags: readonly string[],
): number | null {
  const maxPrefixLen = Math.max(...tags.map((t) => t.length)) - 1;
  const start = Math.max(0, text.length - maxPrefixLen);

  for (let i = start; i < text.length; i++) {
    const suffix = text.slice(i);
    if (tags.some((t) => t.startsWith(suffix) && t !== suffix)) {
      return i;
    }
  }
  return null;
}

/**
 * Creates a stateful streaming parser that strips inline reasoning tags and emits typed chunks.
 * Handles split tag boundaries across chunks, unclosed tags on abort, and markdown code fences.
 *
 * @returns Parser instance with `push` and `flush` methods
 * @author Maruf Bepary
 */
export function createInlineReasoningParser() {
  let activeCloseTag: string | null = null;
  let buffer = "";
  let inCodeFence = false;

  const openTags = REASONING_DELIMITER_PAIRS.map((p) => p.open);

  /**
   * Pushes incoming text delta into the state machine and returns parsed parts.
   *
   * @param chunk - Raw text delta chunk
   * @returns Emitted reasoning or text parts
   */
  function push(chunk: string): StreamContentPart[] {
    buffer += chunk;
    const parts: StreamContentPart[] = [];

    while (buffer.length > 0) {
      if (activeCloseTag !== null) {
        const closeIdx = buffer.indexOf(activeCloseTag);
        if (closeIdx !== -1) {
          const reasoningText = buffer.slice(0, closeIdx);
          if (reasoningText.length > 0) {
            parts.push({ type: "reasoning", text: reasoningText });
          }
          buffer = buffer.slice(closeIdx + activeCloseTag.length);
          if (buffer.startsWith("\n")) {
            buffer = buffer.slice(1);
          }
          activeCloseTag = null;
          continue;
        }

        const prefixIdx = findPotentialTagPrefix(buffer, [activeCloseTag]);
        if (prefixIdx !== null) {
          const toEmit = buffer.slice(0, prefixIdx);
          buffer = buffer.slice(prefixIdx);
          if (toEmit.length > 0) {
            parts.push({ type: "reasoning", text: toEmit });
          }
          break;
        }

        parts.push({ type: "reasoning", text: buffer });
        buffer = "";
        break;
      }

      // In normal text mode
      // Track code fences to avoid interpreting tags in markdown examples
      const fenceIdx = buffer.indexOf("```");
      let earliestTagIdx = -1;
      let matchedPair: (typeof REASONING_DELIMITER_PAIRS)[number] | null = null;

      if (!inCodeFence) {
        for (const pair of REASONING_DELIMITER_PAIRS) {
          const idx = buffer.indexOf(pair.open);
          if (idx !== -1 && (earliestTagIdx === -1 || idx < earliestTagIdx)) {
            earliestTagIdx = idx;
            matchedPair = pair;
          }
        }
      }

      if (
        fenceIdx !== -1 &&
        (earliestTagIdx === -1 || fenceIdx < earliestTagIdx)
      ) {
        const textBefore = buffer.slice(0, fenceIdx + 3);
        parts.push({ type: "text", text: textBefore });
        buffer = buffer.slice(fenceIdx + 3);
        inCodeFence = !inCodeFence;
        continue;
      }

      if (earliestTagIdx !== -1 && matchedPair !== null) {
        const textBefore = buffer.slice(0, earliestTagIdx);
        if (textBefore.length > 0) {
          parts.push({ type: "text", text: textBefore });
        }
        buffer = buffer.slice(earliestTagIdx + matchedPair.open.length);
        if (buffer.startsWith("\n")) {
          buffer = buffer.slice(1);
        }
        activeCloseTag = matchedPair.close;
        continue;
      }

      if (!inCodeFence) {
        const prefixIdx = findPotentialTagPrefix(buffer, openTags);
        if (prefixIdx !== null) {
          const toEmit = buffer.slice(0, prefixIdx);
          buffer = buffer.slice(prefixIdx);
          if (toEmit.length > 0) {
            parts.push({ type: "text", text: toEmit });
          }
          break;
        }
      }

      parts.push({ type: "text", text: buffer });
      buffer = "";
      break;
    }

    return parts;
  }

  /**
   * Flushes remaining buffered text upon stream termination or cancellation.
   *
   * @returns Final remaining parts
   */
  function flush(): StreamContentPart[] {
    const parts: StreamContentPart[] = [];
    if (buffer.length > 0) {
      parts.push({
        type: activeCloseTag !== null ? "reasoning" : "text",
        text: buffer,
      });
      buffer = "";
    }
    return parts;
  }

  return { push, flush };
}

/**
 * Extracts structured reasoning string from a chunk delta or message object.
 *
 * @param delta - Raw delta or message payload from provider response
 * @returns Non-empty reasoning string or null
 * @author Maruf Bepary
 */
export function extractReasoningFromDelta(delta: unknown): string | null {
  if (!delta || typeof delta !== "object") {
    return null;
  }

  const d = delta as Record<string, unknown>;

  if (
    typeof d.reasoning_content === "string" &&
    d.reasoning_content.length > 0
  ) {
    return d.reasoning_content;
  }

  if (typeof d.reasoning === "string" && d.reasoning.length > 0) {
    return d.reasoning;
  }

  if (Array.isArray(d.reasoning_details)) {
    const texts = d.reasoning_details
      .map((item: any) => item?.text ?? item?.summary ?? "")
      .filter((str: string) => typeof str === "string" && str.length > 0);
    if (texts.length > 0) {
      return texts.join("\n");
    }
  }

  return null;
}

/**
 * Transforms outgoing chat completion request JSON body with model options and reasoning configuration.
 *
 * @param rawBody - Target request body dictionary
 * @param config - Provider reasoning format and active effort options
 * @returns Transformed request body
 * @author Maruf Bepary
 */
export function transformChatCompletionRequestBody(
  rawBody: Record<string, unknown>,
  config: {
    reasoningEffortFormat?: ReasoningEffortFormat;
    reasoningEffort?: ReasoningEffort;
    modelOptions?: Record<string, unknown> | null;
  },
): Record<string, unknown> {
  const transformed = {
    ...rawBody,
    ...(config.modelOptions && typeof config.modelOptions === "object"
      ? config.modelOptions
      : {}),
  };

  const format = config.reasoningEffortFormat;
  const effort = config.reasoningEffort;

  if (!format || format === "none" || !effort) {
    return transformed;
  }

  switch (format) {
    case "openai": {
      if (effort === "off") {
        delete transformed.reasoning_effort;
      } else {
        transformed.reasoning_effort = effort;
      }
      break;
    }
    case "openrouter": {
      if (effort === "off") {
        transformed.reasoning = { enabled: false };
      } else {
        transformed.reasoning = { effort };
      }
      break;
    }
    case "anthropic": {
      if (effort === "off") {
        transformed.thinking = { type: "disabled" };
      } else {
        transformed.thinking = {
          type: "enabled",
          budget_tokens: ANTHROPIC_BUDGET_TOKENS[effort],
        };
      }
      break;
    }
  }

  return transformed;
}

/**
 * Creates an intercepting fetch wrapper that normalizes outgoing reasoning parameters and incoming SSE deltas.
 *
 * @param options - Interceptor configuration
 * @returns Fetch function compatible with standard Web Fetch API
 * @author Maruf Bepary
 */
export function createReasoningNormalizingFetch(options: {
  reasoningEffortFormat?: ReasoningEffortFormat;
  reasoningEffort?: ReasoningEffort;
  modelOptions?: Record<string, unknown> | null;
  baseFetch?: typeof fetch;
}) {
  const {
    reasoningEffortFormat,
    reasoningEffort,
    modelOptions,
    baseFetch = fetch,
  } = options;

  return async function reasoningNormalizingFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const headers = new Headers(init?.headers);
    let activeEffort: ReasoningEffort | undefined = reasoningEffort;

    const effortHeader = headers.get("x-ai-client-reasoning-effort");
    if (effortHeader) {
      if (
        effortHeader === "off" ||
        effortHeader === "low" ||
        effortHeader === "medium" ||
        effortHeader === "high"
      ) {
        activeEffort = effortHeader;
      }
      headers.delete("x-ai-client-reasoning-effort");
    }

    let modifiedBody = init?.body;
    if (typeof modifiedBody === "string" && modifiedBody.startsWith("{")) {
      try {
        const parsedBody = JSON.parse(modifiedBody);
        const transformed = transformChatCompletionRequestBody(parsedBody, {
          reasoningEffortFormat,
          reasoningEffort: activeEffort,
          modelOptions,
        });
        modifiedBody = JSON.stringify(transformed);
      } catch {
        // Leave body intact if JSON parsing fails
      }
    }

    const modifiedInit: RequestInit = {
      ...init,
      headers,
      body: modifiedBody,
    };

    const response = await baseFetch(input, modifiedInit);

    if (!response.ok || !response.body) {
      return response;
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream")) {
      const originalStream = response.body;
      const reader = originalStream.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      let isReasoningOpen = false;
      let lineBuffer = "";

      const stream = new ReadableStream<Uint8Array>({
        async pull(controller) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              if (isReasoningOpen) {
                controller.enqueue(
                  encoder.encode(
                    'data: {"choices":[{"index":0,"delta":{"content":"</think>"}}]}\n\n',
                  ),
                );
                isReasoningOpen = false;
              }
              controller.close();
              return;
            }

            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split("\n\n");
            lineBuffer = lines.pop() as string;

            for (const block of lines) {
              if (!block.trim()) continue;

              const dataLine = block
                .split("\n")
                .find((l) => l.startsWith("data: "));
              if (!dataLine) {
                controller.enqueue(encoder.encode(`${block}\n\n`));
                continue;
              }

              const dataStr = dataLine.slice(6).trim();
              if (dataStr === "[DONE]") {
                if (isReasoningOpen) {
                  controller.enqueue(
                    encoder.encode(
                      'data: {"choices":[{"index":0,"delta":{"content":"</think>"}}]}\n\n',
                    ),
                  );
                  isReasoningOpen = false;
                }
                controller.enqueue(encoder.encode(`${block}\n\n`));
                continue;
              }

              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta;

                if (delta) {
                  const reasoning = extractReasoningFromDelta(delta);
                  if (reasoning) {
                    const prefix = isReasoningOpen ? "" : "<think>";
                    isReasoningOpen = true;
                    delta.content = `${prefix}${reasoning}`;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`),
                    );
                    continue;
                  }

                  if (
                    delta.content !== undefined &&
                    delta.content !== null &&
                    isReasoningOpen
                  ) {
                    delta.content = `</think>${delta.content}`;
                    isReasoningOpen = false;
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`),
                    );
                    continue;
                  }
                }

                controller.enqueue(encoder.encode(`${block}\n\n`));
              } catch {
                controller.enqueue(encoder.encode(`${block}\n\n`));
              }
            }
          }
        },
        async cancel(reason) {
          await reader.cancel(reason);
        },
      });

      return new Response(stream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    if (contentType.includes("application/json")) {
      try {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          const message = parsed.choices?.[0]?.message;

          if (message) {
            const reasoning = extractReasoningFromDelta(message);
            if (
              reasoning &&
              typeof message.content === "string" &&
              !message.content.includes("<think>")
            ) {
              message.content = `<think>${reasoning}</think>\n${message.content}`;
            }
          }

          return new Response(JSON.stringify(parsed), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        } catch {
          return new Response(text, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
      } catch {
        return response;
      }
    }

    return response;
  };
}
