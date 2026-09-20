import { describe, expect, it } from "vitest";
import { extractUploadedFilePath } from "@/lib/transform/extract-uploaded-file-path";

describe("extractUploadedFilePath", () => {
  it("returns null for falsy or non-string/non-object results", () => {
    expect(extractUploadedFilePath(null)).toBeNull();
    expect(extractUploadedFilePath(123)).toBeNull();
  });

  it("extracts file_path from direct object", () => {
    expect(extractUploadedFilePath({ file_path: "/uploads/file.txt" })).toBe(
      "/uploads/file.txt",
    );
  });

  it("extracts file_path from JSON string", () => {
    const jsonStr = JSON.stringify({ file_path: "/uploads/json.txt" });
    expect(extractUploadedFilePath(jsonStr)).toBe("/uploads/json.txt");
    expect(extractUploadedFilePath(JSON.stringify({ other: "field" }))).toBeNull();
    expect(extractUploadedFilePath(JSON.stringify(123))).toBeNull();
    expect(extractUploadedFilePath("not json")).toBeNull();
  });

  it("returns null when object has no file_path and content is not an array", () => {
    expect(extractUploadedFilePath({ other: "field" })).toBeNull();
    expect(extractUploadedFilePath({ content: "not-an-array" })).toBeNull();
  });

  it("extracts file_path from content array containing text JSON", () => {
    const result = {
      content: [
        { text: JSON.stringify({ file_path: "/uploads/array.txt" }) },
      ],
    };
    expect(extractUploadedFilePath(result)).toBe("/uploads/array.txt");
  });

  it("handles non-string text, invalid JSON, and missing file_path in content array", () => {
    const result = {
      content: [
        null,
        { text: 123 },
        { text: "not-json" },
        { text: JSON.stringify({ other: "field" }) },
      ],
    };
    expect(extractUploadedFilePath(result)).toBeNull();
  });
});
