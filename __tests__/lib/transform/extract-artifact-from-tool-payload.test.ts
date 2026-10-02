import { describe, expect, it } from "vitest";
import { extractArtifactFromToolPayload } from "@/lib/transform/extract-artifact-from-tool-payload";

describe("extractArtifactFromToolPayload", () => {
  it("returns null for non-object or empty payload", async () => {
    expect(extractArtifactFromToolPayload(null)).toBeNull();
    expect(extractArtifactFromToolPayload("invalid")).toBeNull();
  });

  it("extracts valid structured artifact with type and content", () => {
    const payload = {
      artifact: {
        type: "code",
        content: "console.log(1)",
        title: "Test Script",
      },
    };

    const result = extractArtifactFromToolPayload(payload);
    expect(result).toMatchObject({
      type: "code",
      content: "console.log(1)",
      title: "Test Script",
    });
  });

  it("normalizes artifact_type to type and sheets to JSON content string", () => {
    const payload = {
      artifact_type: "spreadsheet",
      sheets: [{ name: "Sheet1" }],
    };

    const result = extractArtifactFromToolPayload(payload);
    expect(result).toMatchObject({
      type: "spreadsheet",
      content: JSON.stringify({ sheets: [{ name: "Sheet1" }] }),
      title: "Artifact",
    });
  });

  it("returns null when artifact field is not an object", () => {
    expect(extractArtifactFromToolPayload({ artifact: "string-value" })).toBeNull();
  });

  it("returns null when payload lacks valid type or content", () => {
    expect(extractArtifactFromToolPayload({ title: "Only Title" })).toBeNull();
  });
});
