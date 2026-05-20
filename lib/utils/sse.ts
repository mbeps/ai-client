/**
 * Standard Server-Sent Events (SSE) utilities for streaming responses.
 * Provides a text encoder for consistent data framing and standard SSE headers.
 * Used in chat streaming and workflow execution routes.
 *
 * @author GitHub Copilot
 */

/**
 * Encodes an object as a standard SSE data frame.
 * Prepends 'data: ' and appends double newlines for proper event separation.
 *
 * @param data - The object to encode as JSON
 * @returns Uint8Array ready for controller.enqueue()
 */
export const encodeSSE = (data: object): Uint8Array => {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
};

/**
 * Standard headers for SSE responses to ensure proper streaming behavior
 * and prevent proxy buffering or caching.
 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;
