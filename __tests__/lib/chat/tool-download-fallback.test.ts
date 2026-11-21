import { describe, expect, it, vi } from "vitest";
import {
  executeToolDownloadFallback,
  isFileProducerOrMutationTool,
  isStagingTool,
} from "@/lib/chat/tool-download-fallback";
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

  it("handles various argument schemas (shape, properties, preferredKey, and default)", async () => {
    const makeServerTools = (parameters: any) => ({
      generate_file: { execute: vi.fn() },
      custom_export_file: { execute: vi.fn().mockResolvedValue({ success: true, file_content: "base64" }), parameters },
    });

    const toolSourceMap = {
      generate_file: "test-server",
      custom_export_file: "test-server",
    };

    // 0. shape.file_path
    const tools0 = makeServerTools({ shape: { file_path: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-0", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools0,
      toolSourceMap,
    });
    expect(tools0.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: "data.csv" }),
      expect.anything(),
    );

    // 1. shape.path
    const tools1 = makeServerTools({ shape: { path: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-1", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools1,
      toolSourceMap,
    });
    expect(tools1.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ path: "data.csv" }),
      expect.anything(),
    );

    // 2. shape.filePath
    const tools2 = makeServerTools({ shape: { filePath: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-2", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools2,
      toolSourceMap,
    });
    expect(tools2.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: "data.csv" }),
      expect.anything(),
    );

    // 3. shape.filename
    const tools3 = makeServerTools({ shape: { filename: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-3", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools3,
      toolSourceMap,
    });
    expect(tools3.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "data.csv" }),
      expect.anything(),
    );

    // 4. shape.fileName
    const tools4 = makeServerTools({ shape: { fileName: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-4", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools4,
      toolSourceMap,
    });
    expect(tools4.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "data.csv" }),
      expect.anything(),
    );

    // 5. properties.file_path
    const tools5 = makeServerTools({ properties: { file_path: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-5", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools5,
      toolSourceMap,
    });
    expect(tools5.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: "data.csv" }),
      expect.anything(),
    );

    // 6. properties.path
    const tools6 = makeServerTools({ properties: { path: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-6", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools6,
      toolSourceMap,
    });
    expect(tools6.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ path: "data.csv" }),
      expect.anything(),
    );

    // 7. properties.filePath
    const tools7 = makeServerTools({ properties: { filePath: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-7", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools7,
      toolSourceMap,
    });
    expect(tools7.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: "data.csv" }),
      expect.anything(),
    );

    // 8. properties.filename
    const tools8 = makeServerTools({ properties: { filename: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-8", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools8,
      toolSourceMap,
    });
    expect(tools8.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "data.csv" }),
      expect.anything(),
    );

    // 9. properties.fileName
    const tools9 = makeServerTools({ properties: { fileName: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-9", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools9,
      toolSourceMap,
    });
    expect(tools9.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "data.csv" }),
      expect.anything(),
    );

    // 9b. shape and properties with unknown keys falling through
    const tools9b = makeServerTools({ shape: { unknownKey: {} }, properties: { unknownKey: {} } });
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-9b", toolName: "generate_file", args: { file_path: "data.csv" } }],
      activeTools: tools9b,
      toolSourceMap,
    });
    expect(tools9b.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: "data.csv" }),
      expect.anything(),
    );

    // 10. preferredKey (no shape/properties, preserving argKey)
    const tools10 = makeServerTools({});
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-10", toolName: "generate_file", args: { output_file: "data.csv" } }],
      activeTools: tools10,
      toolSourceMap,
    });
    expect(tools10.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ output_file: "data.csv" }),
      expect.anything(),
    );

    // 11. Default fallback to file_path
    const tools11 = makeServerTools({});
    await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-11", toolName: "generate_file", args: "not-an-object", result: { file_path: "data.csv" } }],
      activeTools: tools11,
      toolSourceMap,
    });
    expect(tools11.custom_export_file.execute).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: "data.csv" }),
      expect.anything(),
    );
  });

  it("handles edge cases in file paths, already-downloaded checks, missing tools, and execution errors", async () => {
    // 1. extractFilePathFromRecord with content array (non-JSON text and valid JSON text)
    const completedWithContent: CompletedToolRecord[] = [
      {
        toolCallId: "tc-content",
        toolName: "builder",
        result: {
          content: [
            null,
            { text: "non-json string" },
            { text: JSON.stringify({ file_path: "from_content.pdf" }) },
          ],
        },
      },
    ];

    const fallbackWithContent = await executeToolDownloadFallback({
      completedTools: completedWithContent,
      activeTools: {
        builder: { execute: vi.fn() },
        download_file: {
          execute: vi.fn().mockResolvedValue({ url: "https://example.com/from_content.pdf" }),
        },
      },
      toolSourceMap: {
        builder: "server1",
        download_file: "server1",
      },
    });
    expect(fallbackWithContent).toHaveLength(1);

    // 2. isFileAlreadyDownloaded checks: download call targeting different file, result with base64 targeting different file
    const alreadyDownloadedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-no-callpath",
        toolName: "download_items",
        args: { count: 5 },
      },
      {
        toolCallId: "tc-no-respath",
        toolName: "blob_uploader",
        args: {},
        result: { url: "https://example.com/asset" },
      },
      {
        toolCallId: "tc-other-dl",
        toolName: "download_file",
        args: { file_path: "different_file.pdf" },
      },
      {
        toolCallId: "tc-res-url",
        toolName: "some_uploader",
        args: { file_path: "another_file.pdf" },
        result: { url: "https://example.com/another_file.pdf" },
      },
      {
        toolCallId: "tc-gen",
        toolName: "generator",
        args: { file_path: "target.pdf" },
      },
    ];

    const fallbackTarget = await executeToolDownloadFallback({
      completedTools: alreadyDownloadedTools,
      activeTools: {
        generator: { execute: vi.fn() },
        download_file: {
          execute: vi.fn().mockResolvedValue({ url: "https://example.com/target.pdf" }),
        },
      },
      toolSourceMap: {
        generator: "srv",
        download_file: "srv",
      },
    });
    expect(fallbackTarget).toHaveLength(1);

    // 3. No candidate files found (tools without valid file paths)
    const invalidPathTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-no-path",
        toolName: "create_generic",
        args: { query: "search" },
      },
      {
        toolCallId: "tc-short-path",
        toolName: "create_short",
        args: { file_path: ".a" }, // < 3 chars
      },
      {
        toolCallId: "tc-long-path",
        toolName: "create_long",
        args: { file_path: "a".repeat(260) + ".txt" }, // > 260 chars
      },
      {
        toolCallId: "tc-no-ext",
        toolName: "create_no_ext",
        args: { file_path: "fileWithoutExtension" },
      },
      {
        toolCallId: "tc-non-string",
        toolName: "create_num",
        args: { file_path: 12345 },
      },
    ];
    const emptyFallback = await executeToolDownloadFallback({
      completedTools: invalidPathTools,
      activeTools: {},
      toolSourceMap: {},
    });
    expect(emptyFallback).toHaveLength(0);

    // 4. No matching download tool on server
    const noDownloadTool = await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-nomatch", toolName: "mutator", args: { file_path: "doc.pdf" } }],
      activeTools: { mutator: { execute: vi.fn() }, other_tool: { execute: vi.fn() } },
      toolSourceMap: { mutator: "srv-x", other_tool: "srv-x" },
    });
    expect(noDownloadTool).toHaveLength(0);

    // 5. Tool without source mapping falls back to "unknown"
    const unmappedSource = await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-nomap", toolName: "mutator", args: { file_path: "nomap.pdf" } }],
      activeTools: { mutator: { execute: vi.fn() }, download_file: { execute: vi.fn() } },
      toolSourceMap: {},
    });
    expect(unmappedSource).toHaveLength(0);

    // 6. Download tool missing execute or execute is not a function
    const missingExecute = await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-noexec", toolName: "mutator", args: { file_path: "doc.pdf" } }],
      activeTools: { mutator: { execute: vi.fn() }, download_file: { notAFunction: true } },
      toolSourceMap: { mutator: "srv-y", download_file: "srv-y" },
    });
    expect(missingExecute).toHaveLength(0);

    // 6. Download tool execute returns null
    const nullResult = await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-nullres", toolName: "mutator", args: { file_path: "doc.pdf" } }],
      activeTools: { mutator: { execute: vi.fn() }, download_file: { execute: vi.fn().mockResolvedValue(null) } },
      toolSourceMap: { mutator: "srv-z", download_file: "srv-z" },
    });
    expect(nullResult).toHaveLength(0);

    // 7. Download tool throws Error and non-Error throwable
    const throwingError = await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-throw1", toolName: "mutator", args: { file_path: "doc.pdf" } }],
      activeTools: {
        mutator: { execute: vi.fn() },
        download_file: {
          execute: vi.fn().mockRejectedValue(new Error("Network failed")),
        },
      },
      toolSourceMap: { mutator: "srv-err", download_file: "srv-err" },
    });
    expect(throwingError).toHaveLength(0);

    const throwingString = await executeToolDownloadFallback({
      completedTools: [{ toolCallId: "tc-throw2", toolName: "mutator", args: { file_path: "doc.pdf" } }],
      activeTools: {
        mutator: { execute: vi.fn() },
        download_file: {
          execute: vi.fn().mockRejectedValue("String error"),
        },
      },
      toolSourceMap: { mutator: "srv-err2", download_file: "srv-err2" },
    });
    expect(throwingString).toHaveLength(0);
  });

  it("awaits asynchronous emit callbacks for tool-call and tool-result events", async () => {
    const order: string[] = [];
    const asyncEmit = vi.fn(async (event: any) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push(event.type);
    });

    const activeTools: Record<string, any> = {
      mutator: { execute: vi.fn() },
      download_file: {
        execute: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
      },
    };

    const toolSourceMap: Record<string, string> = {
      mutator: "srv-async",
      download_file: "srv-async",
    };

    const completedTools: CompletedToolRecord[] = [
      { toolCallId: "tc-async", toolName: "mutator", args: { file_path: "report.pdf" } },
    ];

    await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
      emit: asyncEmit,
    });

    expect(order).toEqual(["tool-call", "tool-result"]);
    expect(asyncEmit).toHaveBeenCalledTimes(2);
  });

  it("handles tool args object where none of the keys match target path", async () => {
    const downloadMock = vi.fn().mockResolvedValue({ content: "ok" });
    const activeTools: Record<string, any> = {
      mutator: { execute: vi.fn() },
      download_file: { execute: downloadMock },
    };
    const toolSourceMap: Record<string, string> = {
      mutator: "srv-unmatched",
      download_file: "srv-unmatched",
    };
    const completedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-unmatched",
        toolName: "mutator",
        args: { unrelatedKey: "some-value" },
        result: { file_path: "unmatched.pdf" },
      },
    ];

    const results = await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
    });

    expect(results).toHaveLength(1);
    expect(downloadMock).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: "unmatched.pdf" }),
      expect.anything(),
    );
  });

  it("produces 0 fallback downloads for upload_file + read-only + internal tools", async () => {
    const downloadMock = vi.fn();
    const activeTools: Record<string, any> = {
      upload_file: { execute: vi.fn() },
      get_workbook_metadata: { execute: vi.fn() },
      get_sheet_summary: { execute: vi.fn() },
      get_file_url: { execute: vi.fn() },
      download_file: { execute: downloadMock },
    };
    const toolSourceMap: Record<string, string> = {
      upload_file: "excel-mcp-server",
      get_workbook_metadata: "excel-mcp-server",
      get_sheet_summary: "excel-mcp-server",
      get_file_url: "internal",
      download_file: "excel-mcp-server",
    };
    const completedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-upload",
        toolName: "upload_file",
        args: { url: "https://s3.example.com/input.xlsx" },
        result: { file_path: "staged_input.xlsx" },
      },
      {
        toolCallId: "tc-meta",
        toolName: "get_workbook_metadata",
        args: { file_path: "staged_input.xlsx" },
        result: { sheets: ["Sheet1"] },
      },
      {
        toolCallId: "tc-summary",
        toolName: "get_sheet_summary",
        args: { file_path: "staged_input.xlsx", sheet_name: "Sheet1" },
        result: { rows: 10 },
      },
      {
        toolCallId: "tc-url",
        toolName: "get_file_url",
        args: { file_path: "staged_input.xlsx" },
        result: { url: "https://s3.example.com/signed.xlsx" },
      },
    ];

    const results = await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
    });

    expect(results).toHaveLength(0);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("triggers download_file when upload_file is followed by write_cells with file_path in upload_file.result and write_cells.args", async () => {
    const downloadMock = vi.fn().mockResolvedValue({
      file_content: "base64content",
      filename: "staged_budget.xlsx",
    });
    const activeTools: Record<string, any> = {
      upload_file: { execute: vi.fn() },
      write_cells: { execute: vi.fn() },
      download_file: { execute: downloadMock },
    };
    const toolSourceMap: Record<string, string> = {
      upload_file: "excel-mcp-server",
      write_cells: "excel-mcp-server",
      download_file: "excel-mcp-server",
    };
    const completedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-upload",
        toolName: "upload_file",
        args: { url: "https://s3.example.com/budget.xlsx" },
        result: { file_path: "staged_budget.xlsx" },
      },
      {
        toolCallId: "tc-write",
        toolName: "write_cells",
        args: {
          file_path: "staged_budget.xlsx",
          sheet_name: "Sheet1",
          data: [["Updated"]],
        },
        result: { ok: true },
      },
    ];

    const results = await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
    });

    expect(results).toHaveLength(1);
    expect(downloadMock).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: "staged_budget.xlsx" }),
      expect.anything(),
    );
  });

  it("falls back to latest staged file path on same server when mutation tool omits file_path in args and result", async () => {
    const downloadMock = vi.fn().mockResolvedValue({
      file_content: "base64content",
      filename: "latest_staged.xlsx",
    });
    const activeTools: Record<string, any> = {
      upload_file: { execute: vi.fn() },
      format_cells: { execute: vi.fn() },
      download_file: { execute: downloadMock },
    };
    const toolSourceMap: Record<string, string> = {
      upload_file: "excel-mcp-server",
      format_cells: "excel-mcp-server",
      download_file: "excel-mcp-server",
    };
    const completedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-upload-empty",
        toolName: "upload_file",
        args: { url: "https://s3.example.com/no-ext" },
        result: { ok: true },
      },
      {
        toolCallId: "tc-upload-args-only",
        toolName: "upload_file",
        args: { file_path: "args_staged.xlsx" },
        result: { ok: true },
      },
      {
        toolCallId: "tc-upload-new",
        toolName: "upload_file",
        args: { url: "https://s3.example.com/new.xlsx" },
        result: { file_path: "latest_staged.xlsx" },
      },
      {
        toolCallId: "tc-format",
        toolName: "format_cells",
        args: { range: "A1:B2", bold: true },
        result: { formatted: true },
      },
    ];

    const results = await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
    });

    expect(results).toHaveLength(1);
    expect(downloadMock).toHaveBeenCalledWith(
      expect.objectContaining({ file_path: "latest_staged.xlsx" }),
      expect.anything(),
    );
  });

  it("never triggers fallback downloads for web search or retrieval tools with URL or file-like args", async () => {
    const downloadMock = vi.fn();
    const activeTools: Record<string, any> = {
      web_search: { execute: vi.fn() },
      rival_search: { execute: vi.fn() },
      crawl_page: { execute: vi.fn() },
      download_file: { execute: downloadMock },
    };
    const toolSourceMap: Record<string, string> = {
      web_search: "web-server",
      rival_search: "web-server",
      crawl_page: "web-server",
      download_file: "web-server",
    };
    const completedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-web",
        toolName: "web_search",
        args: { query: "report.pdf", path: "https://example.com/report.pdf" },
        result: { file_path: "cached_report.pdf" },
      },
      {
        toolCallId: "tc-rival",
        toolName: "rival_search",
        args: { query: "q1", file_path: "competitor.csv" },
        result: { output_path: "competitor.csv" },
      },
      {
        toolCallId: "tc-crawl",
        toolName: "crawl_page",
        args: { path: "https://example.com/index.html" },
        result: { file_path: "index.html" },
      },
    ];

    const results = await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
    });

    expect(results).toHaveLength(0);
    expect(downloadMock).not.toHaveBeenCalled();
  });

  it("does not trigger fallback downloads when tool result has error or isError: true", async () => {
    const downloadMock = vi.fn();
    const activeTools: Record<string, any> = {
      upload_file: { execute: vi.fn() },
      create_workbook: { execute: vi.fn() },
      write_cells: { execute: vi.fn() },
      download_file: { execute: downloadMock },
    };
    const toolSourceMap: Record<string, string> = {
      upload_file: "excel-mcp-server",
      create_workbook: "excel-mcp-server",
      write_cells: "excel-mcp-server",
      download_file: "excel-mcp-server",
    };
    const completedTools: CompletedToolRecord[] = [
      {
        toolCallId: "tc-upload-err",
        toolName: "upload_file",
        args: { url: "https://s3.example.com/fail.xlsx" },
        result: { file_path: "failed_stage.xlsx", error: "Failed to fetch" },
      },
      {
        toolCallId: "tc-create-err",
        toolName: "create_workbook",
        args: { file_path: "broken.xlsx" },
        result: { error: "Permission denied" },
      },
      {
        toolCallId: "tc-write-iserror",
        toolName: "write_cells",
        args: { file_path: "broken2.xlsx" },
        result: { isError: true, content: [{ type: "text", text: "Crash" }] },
      },
    ];

    const results = await executeToolDownloadFallback({
      completedTools,
      activeTools,
      toolSourceMap,
    });

    expect(results).toHaveLength(0);
    expect(downloadMock).not.toHaveBeenCalled();
  });
});

describe("isStagingTool & isFileProducerOrMutationTool", () => {
  it("classifies staging tools deterministically", () => {
    expect(isStagingTool("upload_file")).toBe(true);
    expect(isStagingTool("upload_workbook")).toBe(true);
    expect(isStagingTool("upload_custom_doc")).toBe(true);
    expect(isStagingTool("load_file")).toBe(true);
    expect(isStagingTool("load_workbook")).toBe(true);
    expect(isStagingTool("open_file")).toBe(true);
    expect(isStagingTool("open_workbook")).toBe(true);
    expect(isStagingTool("import_file")).toBe(true);
    expect(isStagingTool("stage_file")).toBe(true);
    expect(isStagingTool("ingest_file")).toBe(true);
    expect(isStagingTool("UPLOAD_FILE")).toBe(true);

    expect(isStagingTool("create_workbook")).toBe(false);
    expect(isStagingTool("write_cells")).toBe(false);
    expect(isStagingTool("get_file_url")).toBe(false);
  });

  it("classifies file producer and mutation tools deterministically", () => {
    // Producers & spreadsheet mutation tools -> true
    expect(isFileProducerOrMutationTool("create_workbook")).toBe(true);
    expect(isFileProducerOrMutationTool("write_cells")).toBe(true);
    expect(isFileProducerOrMutationTool("generate_pdf")).toBe(true);
    expect(isFileProducerOrMutationTool("format_cells")).toBe(true);
    expect(isFileProducerOrMutationTool("append_rows")).toBe(true);
    expect(isFileProducerOrMutationTool("mutator")).toBe(true);
    expect(isFileProducerOrMutationTool("generator")).toBe(true);
    expect(isFileProducerOrMutationTool("builder")).toBe(true);

    // Staging tools -> false
    expect(isFileProducerOrMutationTool("upload_file")).toBe(false);
    expect(isFileProducerOrMutationTool("load_workbook")).toBe(false);
    expect(isFileProducerOrMutationTool("stage_file")).toBe(false);

    // Read-only tools -> false
    expect(isFileProducerOrMutationTool("read_cells")).toBe(false);
    expect(isFileProducerOrMutationTool("get_workbook_metadata")).toBe(false);
    expect(isFileProducerOrMutationTool("summarize_sheet")).toBe(false);
    expect(isFileProducerOrMutationTool("analyze_data")).toBe(false);
    expect(isFileProducerOrMutationTool("extract_text")).toBe(false);
    expect(isFileProducerOrMutationTool("crawl_page")).toBe(false);
    expect(isFileProducerOrMutationTool("web_search")).toBe(false);

    // Internal non-producer tools -> false
    expect(isFileProducerOrMutationTool("get_file_url")).toBe(false);
    expect(isFileProducerOrMutationTool("manage_artifact")).toBe(false);
    expect(isFileProducerOrMutationTool("search_knowledge_base")).toBe(false);
    expect(isFileProducerOrMutationTool("delegate_task")).toBe(false);
    expect(isFileProducerOrMutationTool("save_memory")).toBe(false);
    expect(isFileProducerOrMutationTool("manage_memory")).toBe(false);
    expect(isFileProducerOrMutationTool("load_skill")).toBe(false);
    expect(isFileProducerOrMutationTool("create_skill")).toBe(false);
    expect(isFileProducerOrMutationTool("update_skill")).toBe(false);
    expect(isFileProducerOrMutationTool("write_skill_file")).toBe(false);
    expect(isFileProducerOrMutationTool("read_skill_file")).toBe(false);
    expect(isFileProducerOrMutationTool("delete_skill_file")).toBe(false);
    expect(isFileProducerOrMutationTool("scratchpad_write")).toBe(false);

    // Unknown non-producer tools -> false
    expect(isFileProducerOrMutationTool("rival_search")).toBe(false);
    expect(isFileProducerOrMutationTool("ping")).toBe(false);
  });
});
