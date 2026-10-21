import { describe, expect, it, vi } from "vitest";
import { executeToolDownloadFallback } from "@/lib/chat/tool-download-fallback";
import { extractMessageDownloads } from "@/lib/chat/extract-message-downloads";
import type { CompletedToolRecord } from "@/lib/inngest/functions/chat-response";
import type { Message } from "@/types/message/message";

describe("executeToolDownloadFallback", () => {
  it("downloads created spreadsheet workbook when model omitted download_file", async () => {
    const dummyBase64 =
      "UEsDBBQAAAAIAHt0R11Gx01IlQAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE3PTQvCMAwG4L9SdreZih6k";

    const downloadFileMock = vi.fn().mockResolvedValue({
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
            filename: "luxury_sedan_comparison.xlsx",
            size_bytes: 5063,
          }),
        },
      ],
    });

    const activeTools: Record<string, any> = {
      create_workbook: { execute: vi.fn() },
      write_cells: { execute: vi.fn() },
      download_file: { execute: downloadFileMock },
    };

    const toolSourceMap: Record<string, string> = {
      create_workbook: "excel-mcp-server",
      write_cells: "excel-mcp-server",
      download_file: "excel-mcp-server",
    };

    const completedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-create",
        toolName: "create_workbook",
        args: {
          sheet_names: ["Car Comparison", "Technical Specs"],
          file_path: "luxury_sedan_comparison.xlsx",
        },
        result: {
          structuredContent: {
            file_path: "luxury_sedan_comparison.xlsx",
            sheets: ["Car Comparison", "Technical Specs"],
          },
        },
      },
      {
        toolCallId: "tc-write",
        toolName: "write_cells",
        args: {
          file_path: "luxury_sedan_comparison.xlsx",
          sheet_name: "Car Comparison",
          data: [["Lexus IS 300h", "BMW 320d"]],
        },
        result: {
          structuredContent: {
            result: "Wrote 1 rows x 2 cols",
          },
        },
      },
    ];

    const emittedEvents: any[] = [];
    const emit = (event: any) => emittedEvents.push(event);

    const fallbackResults = await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
      emit,
    });

    expect(fallbackResults).toHaveLength(1);
    expect(downloadFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: "luxury_sedan_comparison.xlsx" }),
      expect.anything(),
    );

    // Verify emitted tool-call and tool-result events
    expect(emittedEvents).toEqual([
      expect.objectContaining({
        type: "tool-call",
        toolName: "download_file",
        args: expect.objectContaining({
          file_path: "luxury_sedan_comparison.xlsx",
        }),
      }),
      expect.objectContaining({
        type: "tool-result",
        toolName: "download_file",
        serverName: "excel-mcp-server",
      }),
    ]);

    // Verify completedTools is augmented with the fallback download
    expect(completedTools).toHaveLength(3);
    const lastTool = completedTools[2];
    expect(lastTool.toolName).toBe("download_file");

    // Verify extractMessageDownloads finds the spreadsheet download item
    const msg: Message = {
      id: "msg-assistant-1",
      role: "assistant",
      content: "The spreadsheet has been successfully created!",
      createdAt: new Date(),
      parentId: null,
      childrenIds: [],
      metadata: JSON.stringify({
        toolCalls: completedTools.map((tc) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        })),
        toolResults: completedTools.map((tc) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          result: tc.result,
        })),
      }),
    };

    const downloads = extractMessageDownloads(msg);
    expect(downloads).toHaveLength(1);
    expect(downloads[0]).toMatchObject({
      title: "luxury_sedan_comparison.xlsx",
      type: "spreadsheet",
      extension: "xlsx",
      source: "excel-mcp-server",
    });
    expect(downloads[0].url).toContain(
      "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,",
    );
  });

  it("is generic to any tool creating files (e.g. PDF generator)", async () => {
    const dummyPdfBase64 = "JVBERi0xLjQKJ...";
    const getFileMock = vi.fn().mockResolvedValue({
      fileContent: dummyPdfBase64,
      fileName: "quarterly_financials.pdf",
    });

    const activeTools: Record<string, any> = {
      generate_pdf: { execute: vi.fn() },
      get_file: { execute: getFileMock },
    };

    const toolSourceMap: Record<string, string> = {
      generate_pdf: "custom-pdf-server",
      get_file: "custom-pdf-server",
    };

    const completedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-gen-pdf",
        toolName: "generate_pdf",
        args: {
          path: "/tmp/quarterly_financials.pdf",
          content: "Report content",
        },
        result: { success: true },
      },
    ];

    const fallbackResults = await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
      emit: vi.fn(),
    });

    expect(fallbackResults).toHaveLength(1);
    expect(getFileMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/tmp/quarterly_financials.pdf" }),
      expect.anything(),
    );
  });

  it("does not trigger download fallback if file was already downloaded", async () => {
    const downloadMock = vi.fn();
    const activeTools: Record<string, any> = {
      create_workbook: { execute: vi.fn() },
      download_file: { execute: downloadMock },
    };
    const toolSourceMap: Record<string, string> = {
      create_workbook: "excel-mcp-server",
      download_file: "excel-mcp-server",
    };

    const completedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-create",
        toolName: "create_workbook",
        args: { file_path: "annual_report.xlsx" },
        result: { file_path: "annual_report.xlsx" },
      },
      {
        toolCallId: "tc-dl",
        toolName: "download_file",
        args: { file_path: "annual_report.xlsx" },
        result: {
          file_content: "base64data...",
          filename: "annual_report.xlsx",
        },
      },
    ];

    const fallbackResults = await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
      emit: vi.fn(),
    });

    expect(fallbackResults).toHaveLength(0);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("does not trigger download fallback for read-only tools", async () => {
    const downloadMock = vi.fn();
    const activeTools: Record<string, any> = {
      read_cells: { execute: vi.fn() },
      download_file: { execute: downloadMock },
    };
    const toolSourceMap: Record<string, string> = {
      read_cells: "excel-mcp-server",
      download_file: "excel-mcp-server",
    };

    const completedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-read",
        toolName: "read_cells",
        args: { file_path: "data.xlsx", range: "A1:B10" },
        result: { data: [["1", "2"]] },
      },
    ];

    const fallbackResults = await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
      emit: vi.fn(),
    });

    expect(fallbackResults).toHaveLength(0);
    expect(downloadMock).not.toHaveBeenCalled();
  });
});
