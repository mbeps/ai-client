import { describe, expect, it } from "vitest";
import { extractDownloadFilePayload } from "@/lib/transform/extract-download-file-payload";

describe("extractDownloadFilePayload", () => {
  it("returns null when payload lacks file_content or filename", () => {
    expect(extractDownloadFilePayload(null)).toBeNull();
    expect(extractDownloadFilePayload({ file_content: "abc" })).toBeNull();
  });

  it("extracts fileContent and filename directly", () => {
    const payload = {
      file_content: "base64data",
      filename: "report.xlsx",
    };

    expect(extractDownloadFilePayload(payload)).toEqual({
      fileContent: "base64data",
      filename: "report.xlsx",
    });
  });

  it("extracts from structuredContent or content array", () => {
    const payloadWithStructured = {
      structuredContent: {
        file_content: "data2",
        filename: "data.csv",
      },
    };

    expect(extractDownloadFilePayload(payloadWithStructured)).toEqual({
      fileContent: "data2",
      filename: "data.csv",
    });

    const payloadWithContentArray = {
      content: [
        {
          text: JSON.stringify({ file_content: "data3", filename: "list.xlsx" }),
        },
      ],
    };

    expect(extractDownloadFilePayload(payloadWithContentArray)).toEqual({
      fileContent: "data3",
      filename: "list.xlsx",
    });
  });

  it("ignores non-string text or invalid items in content array", () => {
    const payload = {
      content: [null, { text: 123 }, { other: true }],
    };
    expect(extractDownloadFilePayload(payload)).toBeNull();
  });
});
