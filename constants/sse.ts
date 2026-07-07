/**
 * Standard headers for SSE responses to ensure proper streaming behavior
 * and prevent proxy buffering or caching.
 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;
