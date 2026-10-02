import { describe, expect, it } from "vitest";
import { translateRequestSchema } from "@/schemas/workflows/workflows";

describe("translateRequestSchema", () => {
  it("validates valid translation request", () => {
    const result = translateRequestSchema.safeParse({
      sourceLanguage: "English",
      targetLanguage: "Spanish",
      text: "Hello",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing target language or text", () => {
    const result = translateRequestSchema.safeParse({
      sourceLanguage: "English",
      targetLanguage: "",
      text: "",
    });
    expect(result.success).toBe(false);
  });
});
