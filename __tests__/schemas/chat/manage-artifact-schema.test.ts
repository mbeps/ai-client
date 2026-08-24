import { describe, it, expect } from "vitest";
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
