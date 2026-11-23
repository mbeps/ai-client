import { describe, expect, it } from "vitest";
import { extractArtifactFromToolPayload } from "@/lib/workflows/extract-artifact-from-tool-payload";
import { extractDownloadFilePayload } from "@/lib/workflows/extract-download-file-payload";
import { extractUploadedFilePath } from "@/lib/workflows/extract-uploaded-file-path";
import { isSpreadsheetMutationTool } from "@/lib/workflows/is-spreadsheet-mutation-tool";
import { normaliseToolPayload } from "@/lib/workflows/normalise-tool-payload";
import { tryParseJson } from "@/lib/workflows/try-parse-json";

describe("workflow payload helpers", () => {
  it("tryParseJson parses valid JSON and falls back to raw string", () => {
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(tryParseJson("plain")).toBe("plain");
  });

  it("normaliseToolPayload parses string payloads and passes objects through", () => {
    expect(normaliseToolPayload('{"k":"v"}')).toEqual({ k: "v" });
    expect(normaliseToolPayload({ k: "v" })).toEqual({ k: "v" });
  });

  it("isSpreadsheetMutationTool identifies known and write_* tools", () => {
    expect(isSpreadsheetMutationTool("write_cell")).toBe(true);
    expect(isSpreadsheetMutationTool("format_cells")).toBe(true);
    expect(isSpreadsheetMutationTool("read_range")).toBe(false);
  });

  it("extractUploadedFilePath extracts from string, object, structuredContent, and content[]", () => {
    expect(extractUploadedFilePath(null)).toBeNull();
    expect(extractUploadedFilePath(42)).toBeNull();
    expect(extractUploadedFilePath('{"file_path":"/tmp/a.xlsx"}')).toBe(
      "/tmp/a.xlsx",
    );
    expect(
      extractUploadedFilePath({ structuredContent: { filePath: "/tmp/b.xlsx" } }),
    ).toBe("/tmp/b.xlsx");
    expect(
      extractUploadedFilePath({
        content: [{ text: "not json" }, { text: '{"path":"/tmp/c.xlsx"}' }],
      }),
    ).toBe("/tmp/c.xlsx");
    expect(
      extractUploadedFilePath({
        content: [
          { text: "not json" },
          { text: '"string-json"' },
          { text: '{"other":1}' },
        ],
      }),
    ).toBeNull();
    expect(extractUploadedFilePath({ foo: "bar" })).toBeNull();
  });

  it("extractArtifactFromToolPayload normalises nested and flat artifacts", () => {
    expect(extractArtifactFromToolPayload(null)).toBeNull();
    expect(extractArtifactFromToolPayload({ artifact: null })).toBeNull();
    expect(extractArtifactFromToolPayload({ title: "No type or content" })).toBeNull();
    expect(
      extractArtifactFromToolPayload({
        artifact: {
          artifact_type: "spreadsheet",
          sheets: [{ name: "S1", data: [["a"]] }],
        },
      }),
    ).toEqual({
      artifact_type: "spreadsheet",
      type: "spreadsheet",
      title: "Artifact",
      sheets: [{ name: "S1", data: [["a"]] }],
      content: JSON.stringify({ sheets: [{ name: "S1", data: [["a"]] }] }),
    });
    expect(
      extractArtifactFromToolPayload({
        type: "markdown",
        title: "Doc",
        content: "# Hi",
      }),
    ).toEqual({ type: "markdown", title: "Doc", content: "# Hi" });
  });

  it("extractDownloadFilePayload extracts fileContent and basename", () => {
    expect(extractDownloadFilePayload(null)).toBeNull();
    expect(
      extractDownloadFilePayload({
        file_content: "YWJj",
        file_path: "dir\\sub\\out.xlsx",
      }),
    ).toEqual({ fileContent: "YWJj", filename: "out.xlsx" });
    expect(
      extractDownloadFilePayload({
        content: [{ text: JSON.stringify({ base64: "ZGVm", filename: "x.csv" }) }],
      }),
    ).toEqual({ fileContent: "ZGVm", filename: "x.csv" });
    expect(
      extractDownloadFilePayload({
        content: [{ text: 123 as any }],
      }),
    ).toBeNull();
    expect(extractDownloadFilePayload({ nope: true })).toBeNull();
  });
});
