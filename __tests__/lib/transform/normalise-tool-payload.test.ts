import { describe, expect, it } from "vitest";
import { normaliseToolPayload } from "@/lib/transform/normalise-tool-payload";

describe("normaliseToolPayload", () => {
  it("parses JSON string payload to object", () => {
    const jsonStr = '{"key":"value"}';
    expect(normaliseToolPayload(jsonStr)).toEqual({ key: "value" });
  });

  it("returns non-string payload as-is", () => {
    const obj = { a: 1 };
    expect(normaliseToolPayload(obj)).toBe(obj);
    expect(normaliseToolPayload(null)).toBeNull();
  });
});
