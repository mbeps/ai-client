import { describe, it, expect } from "vitest";
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
});
