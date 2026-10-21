import { describe, expect, it } from "vitest";
import {
  extractMessageDownloads,
  inferDownloadType,
} from "@/lib/chat/extract-message-downloads";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

describe("inferDownloadType", () => {
  it("correctly identifies spreadsheet extensions", () => {
    expect(inferDownloadType("xlsx")).toBe("spreadsheet");
    expect(inferDownloadType("xls")).toBe("spreadsheet");
    expect(inferDownloadType("csv")).toBe("spreadsheet");
    expect(inferDownloadType("parquet")).toBe("spreadsheet");
  });

  it("correctly identifies document extensions", () => {
    expect(inferDownloadType("pdf")).toBe("document");
    expect(inferDownloadType("docx")).toBe("document");
    expect(inferDownloadType("txt")).toBe("document");
  });

  it("correctly identifies archives", () => {
    expect(inferDownloadType("zip")).toBe("archive");
    expect(inferDownloadType("tar")).toBe("archive");
    expect(inferDownloadType("gz")).toBe("archive");
  });

  it("falls back to MIME type if extension is missing", () => {
    expect(inferDownloadType(undefined, "application/pdf")).toBe("document");
    expect(
      inferDownloadType(
        undefined,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("spreadsheet");
    expect(inferDownloadType(undefined, "application/zip")).toBe("archive");
    expect(inferDownloadType(undefined, "application/x-tar")).toBe("archive");
    expect(inferDownloadType(undefined, "application/gzip")).toBe("archive");
    expect(inferDownloadType(undefined, "application/x-compressed")).toBe("archive");
    expect(inferDownloadType(undefined, "image/png")).toBe("image");
    expect(inferDownloadType(undefined, "audio/mpeg")).toBe("audio");
    expect(inferDownloadType(undefined, "video/mp4")).toBe("video");
    expect(inferDownloadType(undefined, "application/json")).toBe("code");
    expect(inferDownloadType(undefined, "application/xml")).toBe("code");
    expect(inferDownloadType(undefined, "text/javascript")).toBe("code");
    expect(inferDownloadType(undefined, "application/octet-stream")).toBe("file");
    expect(inferDownloadType(undefined, undefined)).toBe("file");
  });

  it("handles unknown extension falling back to MIME type or file", () => {
    expect(inferDownloadType("unknownext", "application/pdf")).toBe("document");
    expect(inferDownloadType("unknownext")).toBe("file");
  });
});

describe("extractMessageDownloads", () => {
  const baseMessage: Message = {
    id: "msg-assistant-1",
    role: "assistant",
    content: "Here is your generated material.",
    createdAt: new Date("2026-10-07T12:00:00Z"),
    parentId: null,
    childrenIds: [],
    metadata: null,
  };

  it("handles invalid extension patterns in filenames", () => {
    const msg: Message = {
      ...baseMessage,
      content: "Check this [Bad Ext](https://example.com/file.toolongextensionname) and [Special](https://example.com/file.ext!)",
    };
    const items = extractMessageDownloads(msg);
    expect(items).toEqual([]);
  });

  it("returns empty array for user messages", () => {
    const userMsg: Message = { ...baseMessage, role: "user" };
    expect(extractMessageDownloads(userMsg)).toEqual([]);
  });

  it("extracts download from toolResults with url and filename", () => {
    const msg: Message = {
      ...baseMessage,
      metadata: JSON.stringify({
        toolResults: [
          {
            toolCallId: "tc-1",
            toolName: "create_spreadsheet",
            result: {
              url: "https://minio.local/bucket/annual_budget.xlsx",
              filename: "annual_budget.xlsx",
              size: 45000,
            },
          },
        ],
      }),
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "annual_budget.xlsx",
      url: "https://minio.local/bucket/annual_budget.xlsx",
      type: "spreadsheet",
      extension: "xlsx",
      size: 45000,
      source: "create_spreadsheet",
    });
  });

  it("extracts download from toolResults with download_url and nested file object", () => {
    const msg: Message = {
      ...baseMessage,
      metadata: JSON.stringify({
        toolResults: [
          {
            toolCallId: "tc-2",
            toolName: "export_report",
            result: {
              file: {
                url: "https://storage.provider.com/exports/q4_summary.pdf",
                name: "Q4 Final Summary",
              },
            },
          },
        ],
      }),
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Q4 Final Summary");
    expect(items[0].type).toBe("document");
    expect(items[0].extension).toBe("pdf");
  });

  it("extracts download from activeToolCalls during streaming", () => {
    const activeCalls: ToolCallState[] = [
      {
        toolCallId: "tc-active",
        toolName: "data_exporter",
        args: {},
        result: {
          url: "https://example.com/archive.zip",
        },
      },
    ];

    const items = extractMessageDownloads(baseMessage, activeCalls);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("archive");
    expect(items[0].title).toBe("archive.zip");
  });

  it("extracts downloads from markdown links in message content", () => {
    const msg: Message = {
      ...baseMessage,
      content:
        "Please download the file here: [Financial Forecast](https://storage.s3.amazonaws.com/outputs/forecast.xlsx).",
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Financial Forecast");
    expect(items[0].type).toBe("spreadsheet");
    expect(items[0].url).toBe(
      "https://storage.s3.amazonaws.com/outputs/forecast.xlsx",
    );
  });

  it("extracts downloads from bare URLs in message content", () => {
    const msg: Message = {
      ...baseMessage,
      content:
        "Output generated at https://my-bucket.s3.amazonaws.com/transforms/run_result.csv for processing.",
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("run_result.csv");
    expect(items[0].type).toBe("spreadsheet");
    expect(items[0].source).toBe("Storage");
  });

  it("deduplicates identical URLs between tool results and markdown content", () => {
    const sharedUrl = "https://minio.local:9000/bucket/dedup.csv";
    const msg: Message = {
      ...baseMessage,
      content: `Download: [CSV File](${sharedUrl})`,
      metadata: JSON.stringify({
        toolResults: [
          {
            toolCallId: "tc-3",
            toolName: "csv_gen",
            result: { url: sharedUrl, filename: "dedup.csv" },
          },
        ],
      }),
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("dedup.csv");
  });

  it("extracts download from MCP tool result with stringified JSON content and base64 file", () => {
    const dummyBase64 =
      "UEsDBBQAAAAIAHt0R11Gx01IlQAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE3PTQvCMAwG4L9SdreZih6k";
    const msg: Message = {
      ...baseMessage,
      metadata: JSON.stringify({
        toolCalls: [
          {
            toolCallId: "tc-excel-dl",
            toolName: "download_file",
            args: { file_path: "/tmp/maruf_credentials.xlsx" },
          },
        ],
        toolResults: [
          {
            toolCallId: "tc-excel-dl",
            toolName: "download_file",
            result: {
              _meta: {
                "io.modelcontextprotocol/serverInfo": {
                  name: "excel-mcp-server",
                  version: "0.1.0",
                },
              },
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    file_content: dummyBase64,
                    filename: "maruf_credentials.xlsx",
                    size_bytes: 5063,
                  }),
                },
              ],
            },
          },
        ],
      }),
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("maruf_credentials.xlsx");
    expect(items[0].type).toBe("spreadsheet");
    expect(items[0].extension).toBe("xlsx");
    expect(items[0].size).toBe(5063);
    expect(items[0].source).toBe("excel-mcp-server");
    expect(items[0].url).toContain(
      "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,",
    );
  });

  it("resolves filename from tool args file_path when not explicitly present in base64 output", () => {
    const dummyBase64 =
      "UEsDBBQAAAAIAHt0R11Gx01IlQAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE3PTQvCMAwG4L9SdreZih6k";
    const msg: Message = {
      ...baseMessage,
      metadata: JSON.stringify({
        toolCalls: [
          {
            toolCallId: "tc-arg-path",
            toolName: "export_excel",
            args: { file_path: "/tmp/sales_report.xlsx" },
          },
        ],
        toolResults: [
          {
            toolCallId: "tc-arg-path",
            toolName: "export_excel",
            result: {
              file_content: dummyBase64,
            },
          },
        ],
      }),
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("sales_report.xlsx");
    expect(items[0].type).toBe("spreadsheet");
    expect(items[0].extension).toBe("xlsx");
  });

  it("extracts downloads from various structured payload formats: array, files, downloads, urls, structuredContent", () => {
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-arrays",
            toolName: "batch_export",
            result: [
              {
                url: "https://example.com/item1.pdf",
                contentType: "application/pdf",
              },
              {
                url: "https://example.com/item2.docx",
                mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              },
            ],
          },
          {
            toolCallId: "tc-nested",
            toolName: "nested_exporter",
            result: {
              structuredContent: {
                url: "https://example.com/structured.csv",
              },
              files: [
                {
                  downloadUrl: "https://example.com/file_in_list.xlsx",
                },
              ],
              downloads: [
                {
                  fileUrl: "https://example.com/download_item.parquet",
                },
              ],
              urls: [
                {
                  link: "https://example.com/link_item.tar",
                },
              ],
            },
          },
        ],
      },
    };

    const items = extractMessageDownloads(msg);
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.some((i) => i.title === "item1.pdf")).toBe(true);
    expect(items.some((i) => i.title === "item2.docx")).toBe(true);
    expect(items.some((i) => i.title === "structured.csv")).toBe(true);
    expect(items.some((i) => i.title === "file_in_list.xlsx")).toBe(true);
    expect(items.some((i) => i.title === "download_item.parquet")).toBe(true);
    expect(items.some((i) => i.title === "link_item.tar")).toBe(true);
  });

  it("extracts from plain text tool output containing embedded URLs", () => {
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-text-embedded",
            toolName: "shell_curl",
            result: "Generated export at https://example.com/archive.zip and report at https://my-bucket.s3.amazonaws.com/outputs/data.csv",
          },
        ],
      },
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("archive.zip");
    expect(items[1].title).toBe("data.csv");
  });

  it("extracts base64 data key when accompanied by mimeType or fileName or file_path", () => {
    const dummyBase64 =
      "UEsDBBQAAAAIAHt0R11Gx01IlQAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE3PTQvCMAwG4L9SdreZih6k";
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-data-key",
            toolName: "converter",
            result: {
              data: dummyBase64,
              fileName: "converted.png",
              contentType: "image/png",
            },
          },
        ],
      },
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("converted.png");
    expect(items[0].type).toBe("image");
  });

  it("handles MCP image and resource content blocks", () => {
    const dummyBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-mcp-blocks",
            toolName: "image_server",
            result: {
              content: [
                {
                  type: "image",
                  data: dummyBase64,
                  mimeType: "image/png",
                },
                {
                  type: "resource",
                  resource: {
                    url: "https://example.com/res.csv",
                  },
                },
                {
                  type: "text",
                  text: "Plain non-json text containing https://example.com/file.txt",
                },
              ],
            },
          },
        ],
      },
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(3);
    expect(items.some((i) => i.type === "image")).toBe(true);
    expect(items.some((i) => i.title === "res.csv")).toBe(true);
    expect(items.some((i) => i.title === "file.txt")).toBe(true);
  });

  it("ignores generic titles like 'download', 'link', 'file', 'here' in favor of filename", () => {
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-generic-title",
            toolName: "file_tool",
            result: {
              url: "https://example.com/actual_report.pdf",
              filename: "download",
            },
          },
        ],
      },
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("actual_report.pdf");
  });

  it("handles data URL without title falling back to 'download'", () => {
    const dummyBase64 =
      "UEsDBBQAAAAIAHt0R11Gx01IlQAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE3PTQvCMAwG4L9SdreZih6k";
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-notitle-data",
            toolName: "binary_tool",
            result: {
              file_data: dummyBase64,
            },
          },
        ],
      },
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("download");
  });

  it("canonicalizes malformed URL using query split fallback when new URL throws", () => {
    const malformedUrl = "http://[invalid-ipv6/download.csv?token=123";
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-badurl",
            toolName: "bad_url_tool",
            result: {
              url: malformedUrl,
            },
          },
        ],
      },
    };

    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("download.csv");
  });

  it("handles various base64 file indication keys and rejects unindicated data", () => {
    const dummyBase64 =
      "UEsDBBQAAAAIAHt0R11Gx01IlQAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE3PTQvCMAwG4L9SdreZih6k";

    // Unindicated generic data key should NOT produce a download item
    const unindicatedMsg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-no-ind",
            toolName: "data_tool",
            result: { data: dummyBase64 },
          },
        ],
      },
    };
    expect(extractMessageDownloads(unindicatedMsg)).toHaveLength(0);

    // Indicated by filename
    const filenameMsg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-fn",
            toolName: "data_tool",
            result: { data: dummyBase64, filename: "output1.bin" },
          },
        ],
      },
    };
    expect(extractMessageDownloads(filenameMsg)).toHaveLength(1);

    // Indicated by fileName
    const fileNameMsg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-fn2",
            toolName: "data_tool",
            result: { data: dummyBase64, fileName: "output2.bin" },
          },
        ],
      },
    };
    expect(extractMessageDownloads(fileNameMsg)).toHaveLength(1);

    // Indicated by file_path on result
    const filePathMsg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-fp",
            toolName: "data_tool",
            result: { data: dummyBase64, file_path: "/tmp/output3.bin" },
          },
        ],
      },
    };
    expect(extractMessageDownloads(filePathMsg)).toHaveLength(1);

    // Indicated by file_path on toolArgs
    const toolArgsMsg: Message = {
      ...baseMessage,
      metadata: {
        toolCalls: [
          {
            toolCallId: "tc-args",
            toolName: "data_tool",
            args: { file_path: "/tmp/output4.bin" },
          },
        ],
        toolResults: [
          {
            toolCallId: "tc-args",
            toolName: "data_tool",
            result: { data: dummyBase64 },
          },
        ],
      },
    };
    expect(extractMessageDownloads(toolArgsMsg)).toHaveLength(1);
  });

  it("handles record mimeType candidate and MCP image default png mimeType", () => {
    const dummyBase64 =
      "UEsDBBQAAAAIAHt0R11Gx01IlQAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE3PTQvCMAwG4L9SdreZih6k";

    // record with mimeType
    const mimeMsg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-mime",
            toolName: "pdf_tool",
            result: {
              data: dummyBase64,
              mimeType: "application/pdf",
              filename: "sample.pdf",
            },
          },
        ],
      },
    };
    const items = extractMessageDownloads(mimeMsg);
    expect(items).toHaveLength(1);
    expect(items[0].mimeType).toBe("application/pdf");

    // MCP image without mimeType -> defaults to image/png
    const mcpMsg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-mcp-img",
            toolName: "mcp_tool",
            result: {
              content: [
                null,
                "not-object",
                {
                  type: "image",
                  data: dummyBase64,
                },
              ],
            },
          },
        ],
      },
    };
    const mcpItems = extractMessageDownloads(mcpMsg);
    expect(mcpItems).toHaveLength(1);
    expect(mcpItems[0].mimeType).toBe("image/png");
  });

  it("handles plain text URLs with and without file extensions or storage domains", () => {
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-txt",
            toolName: "web_search",
            result:
              "Visit https://example.com/no-extension-page and https://s3.amazonaws.com/mybucket/data",
          },
        ],
      },
    };
    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://s3.amazonaws.com/mybucket/data");
  });

  it("handles primitive, null, and empty payloads safely in tool results and metadata", () => {
    // Falsy payload, number payload, boolean payload, null item in toolResults
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          null,
          "primitive-string-without-url",
          {
            toolCallId: "tc-primitives",
            // missing toolName -> defaults to "tool"
            result: 12345,
          },
          {
            toolCallId: "tc-null",
            toolName: "null_tool",
            result: null,
          },
          {
            toolCallId: "tc-invalid-url",
            toolName: "ftp_tool",
            result: { url: "ftp://example.com/file.zip" },
          },
        ],
      },
    };
    expect(extractMessageDownloads(msg)).toHaveLength(0);

    // metadata is invalid JSON string
    const invalidJsonMsg: Message = {
      ...baseMessage,
      metadata: "{invalid-json",
    };
    expect(extractMessageDownloads(invalidJsonMsg)).toHaveLength(0);

    // metadata is JSON primitive
    const primitiveJsonMsg: Message = {
      ...baseMessage,
      metadata: "12345",
    };
    expect(extractMessageDownloads(primitiveJsonMsg)).toHaveLength(0);
  });

  it("handles activeToolCalls with missing or empty results", () => {
    const activeTools: ToolCallState[] = [
      {
        toolCallId: "call_active_no_res",
        toolName: "running_tool",
        state: "call",
        // result is undefined
      },
    ];
    expect(extractMessageDownloads(baseMessage, activeTools)).toHaveLength(0);
  });

  it("handles markdown storage URLs with Storage source label and handles empty content", () => {
    const msg: Message = {
      ...baseMessage,
      content: "Download from S3: [Data Dump](https://s3.amazonaws.com/mybucket/archive)",
    };
    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe("Storage");

    const emptyContentMsg: Message = {
      ...baseMessage,
      content: "",
    };
    expect(extractMessageDownloads(emptyContentMsg)).toHaveLength(0);
  });

  it("extracts download from tool result using output instead of result", () => {
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-output-field",
            toolName: "exporter",
            output: { url: "https://example.com/output-report.pdf" },
          },
        ],
      },
    };
    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("output-report.pdf");
  });

  it("labels non-storage markdown links as Link", () => {
    const msg: Message = {
      ...baseMessage,
      content: "Read the spec: [Spec Document](https://example.com/docs/spec.pdf)",
    };
    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].source).toBe("Link");
  });

  it("accepts base64url encoded binary data", () => {
    const base64UrlData =
      "UEsDBBQAAAAIAHt0R11Gx01IlQAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE3PTQvCMAwG4L9SdreZih6k-_12";
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-b64url",
            toolName: "url_safe_b64",
            result: { data: base64UrlData, filename: "safe.bin" },
          },
        ],
      },
    };
    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("safe.bin");
  });

  it("ignores base64 data shorter than 20 characters", () => {
    const msg: Message = {
      ...baseMessage,
      metadata: {
        toolResults: [
          {
            toolCallId: "tc-short-b64",
            toolName: "short_tool",
            result: { data: "dGVzdA==", filename: "short.bin" },
          },
        ],
      },
    };
    const items = extractMessageDownloads(msg);
    expect(items).toHaveLength(0);
  });
});
