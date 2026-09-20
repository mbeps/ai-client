import { describe, expect, it } from "vitest";
import { encodeSSE } from "@/lib/encode-sse";

describe("encodeSSE lib", () => {
  it("formats object into SSE protocol string", () => {
    const encoded = encodeSSE({ message: "hello" });
    const decoded = new TextDecoder().decode(encoded);
    expect(decoded).toBe('data: {"message":"hello"}\n\n');
  });
});
