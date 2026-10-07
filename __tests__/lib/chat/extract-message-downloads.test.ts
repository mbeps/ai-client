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
});

