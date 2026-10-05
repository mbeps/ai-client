import { describe, expect, it } from "vitest";
import { SSE_HEADERS } from "@/lib/sse";

describe("sse constants", () => {
  it("validates SSE_HEADERS object", () => {
    expect(SSE_HEADERS["Content-Type"]).toBe("text/event-stream");
    expect(SSE_HEADERS["Cache-Control"]).toBe("no-cache");
    expect(SSE_HEADERS.Connection).toBe("keep-alive");
  });
});
