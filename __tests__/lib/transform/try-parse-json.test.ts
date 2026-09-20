import { describe, expect, it } from "vitest";
import { tryParseJson } from "@/lib/transform/try-parse-json";

describe("tryParseJson", () => {
  it("parses valid JSON string", () => {
    expect(tryParseJson('{"foo":"bar"}')).toEqual({ foo: "bar" });
  });

  it("returns original string on invalid JSON", () => {
    const invalid = "not-json-string";
    expect(tryParseJson(invalid)).toBe(invalid);
  });
});
