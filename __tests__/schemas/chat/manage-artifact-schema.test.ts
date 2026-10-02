import { describe, expect, it } from "vitest";
import { z } from "zod";
import { manageArtifactSchema } from "@/schemas/chat/chat";

describe("manageArtifactSchema — optional id field (ART-02)", () => {
  it("accepts an artifact with an id", () => {
    const result = manageArtifactSchema.safeParse({
      type: "markdown",
      title: "T",
      content: "# hi",
      id: "art-123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).id).toBe("art-123");
    }
  });

  it("accepts an artifact without an id (backwards compatible)", () => {
    const result = manageArtifactSchema.safeParse({
      type: "html",
      content: "<p>x</p>",
    });
    expect(result.success).toBe(true);
  });
});

describe("manageArtifactSchema — type enum (F-06)", () => {
  it.each(["markdown", "spreadsheet", "html", "mermaid"])(
    "accepts valid type %s",
    (type) => {
      const result = manageArtifactSchema.safeParse({ type, content: "x" });
      expect(result.success).toBe(true);
    },
  );

  it("rejects an invalid type with ZodError", () => {
    const result = manageArtifactSchema.safeParse({
      type: "video",
      content: "x",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(z.ZodError);
    }
  });
});
