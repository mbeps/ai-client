// Typed SSE event union — mirrors what the chat route emits
export type SseEvent =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; args?: unknown }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      result?: unknown;
    }
  | { type: "transform-start"; runId: string }
  | { type: "transform-step-start"; stepIndex: number; label: string }
  | { type: "transform-complete"; runId: string; status: string }
  | { type: "done"; id: string; metadata?: Record<string, unknown> }
  | { type: "error"; message?: string; code?: string };

/**
 * Reads a Server-Sent Events ReadableStream and yields parsed typed events.
 * Handles chunked reads, incomplete-line buffering, and malformed lines gracefully.
 *
 * @param body - ReadableStream from a fetch response (response.body)
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        try {
          const event = JSON.parse(trimmed.slice(6)) as SseEvent;
          yield event;
        } catch (e) {
          console.error("Failed to parse SSE event:", e, trimmed);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
