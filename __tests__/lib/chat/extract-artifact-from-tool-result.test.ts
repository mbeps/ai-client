import { describe, expect, it } from "vitest";
import { extractArtifactFromToolResult } from "@/lib/chat/extract-artifact-from-tool-result";

describe("extractArtifactFromToolResult", () => {
  it("returns null for non-manage_artifact tool results", () => {
    expect(
      extractArtifactFromToolResult({
        toolName: "search_knowledge_base",
        result: { results: [] },
      }),
    ).toBeNull();
    expect(extractArtifactFromToolResult(null)).toBeNull();
    expect(extractArtifactFromToolResult(undefined)).toBeNull();
  });

  it("extracts artifact when result contains an artifact object", () => {
    const tr = {
      toolName: "manage_artifact",
      result: {
        success: true,
        artifact: {
          id: "art-1",
          type: "spreadsheet",
          title: "Pricing Data",
          content: JSON.stringify({
            sheets: [{ name: "S1", data: [["A", "B"]] }],
          }),
        },
      },
    };

    const art = extractArtifactFromToolResult(tr);
    expect(art).toEqual({
      id: "art-1",
      type: "spreadsheet",
      title: "Pricing Data",
      content: JSON.stringify({ sheets: [{ name: "S1", data: [["A", "B"]] }] }),
    });
  });

  it("extracts artifact when result is a stringified JSON string", () => {
    const tr = {
      toolName: "manage_artifact",
      result: JSON.stringify({
        success: true,
        artifact: {
          id: "art-2",
          type: "markdown",
          title: "Report",
          content: "# Title",
        },
      }),
    };

    const art = extractArtifactFromToolResult(tr);
    expect(art).toEqual({
      id: "art-2",
      type: "markdown",
      title: "Report",
      content: "# Title",
    });
  });

  it("extracts artifact from v7 output field instead of result", () => {
    const tr = {
      toolName: "manage_artifact",
      output: {
        success: true,
        artifact: {
          id: "art-3",
          type: "html",
          title: "Preview",
          content: "<div>Hello</div>",
        },
      },
    };

    const art = extractArtifactFromToolResult(tr);
    expect(art).toEqual({
      id: "art-3",
      type: "html",
      title: "Preview",
      content: "<div>Hello</div>",
    });
  });

  it("converts raw sheets array to stringified JSON content if content is missing", () => {
    const tr = {
      toolName: "manage_artifact",
      result: {
        artifact: {
          id: "art-4",
          type: "spreadsheet",
          title: "Direct Sheets",
          sheets: [{ name: "Sheet1", data: [[1, 2]] }],
        },
      },
    };

    const art = extractArtifactFromToolResult(tr);
    expect(art?.content).toBe(
      JSON.stringify({ sheets: [{ name: "Sheet1", data: [[1, 2]] }] }),
    );
  });

  it("returns null when raw string result is invalid JSON", () => {
    expect(
      extractArtifactFromToolResult({
        toolName: "manage_artifact",
        result: "{invalid-json",
      }),
    ).toBeNull();
  });

  it("returns null when artifact type is unsupported", () => {
    expect(
      extractArtifactFromToolResult({
        toolName: "manage_artifact",
        result: { artifact: { type: "unsupported_type", content: "..." } },
      }),
    ).toBeNull();
  });

  it("stringifies non-string content object and defaults title if absent", () => {
    const art = extractArtifactFromToolResult({
      toolName: "manage_artifact",
      result: {
        artifact: {
          type: "markdown",
          content: { section: 1 },
        },
      },
    });

    expect(art?.title).toBe("Untitled Artifact");
    expect(art?.content).toBe(JSON.stringify({ section: 1 }));
  });

  it("supports artifact_type property and falls back to toolCallId or artifact-default for id", () => {
    const art1 = extractArtifactFromToolResult({
      toolName: "manage_artifact",
      toolCallId: "call-99",
      result: {
        artifact: {
          artifact_type: "mermaid",
          content: "graph TD;",
        },
      },
    });
    expect(art1?.id).toBe("call-99-artifact");
    expect(art1?.type).toBe("mermaid");

    const art2 = extractArtifactFromToolResult({
      toolName: "manage_artifact",
      result: {
        artifact: {
          type: "markdown",
          content: "hello",
        },
      },
    });
    expect(art2?.id).toBe("artifact-default");
  });

  it("handles empty content, whitespace id and title, and missing artifact_type/type", () => {
    // Neither type nor artifact_type provided
    const artNoType = extractArtifactFromToolResult({
      toolName: "manage_artifact",
      result: {
        artifact: {
          id: "art-1",
        },
      },
    });
    expect(artNoType).toBeNull();

    // Whitespace id and title, undefined content, top-level flat record inside result
    const artWhitespace = extractArtifactFromToolResult({
      toolName: "manage_artifact",
      result: {
        id: "   ",
        title: "   ",
        type: "markdown",
        // content is undefined
      },
    });
    expect(artWhitespace).toEqual({
      id: "artifact-default",
      type: "markdown",
      title: "Untitled Artifact",
      content: "",
    });
  });
});
