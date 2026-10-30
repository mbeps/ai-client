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
        toolName: "generic_tool",
        args: { query: "search" },
      },
      {
        toolCallId: "tc-short-path",
        toolName: "short_tool",
        args: { file_path: ".a" }, // < 3 chars
      },
      {
        toolCallId: "tc-long-path",
        toolName: "long_tool",
        args: { file_path: "a".repeat(260) + ".txt" }, // > 260 chars
      },
      {
        toolCallId: "tc-no-ext",
        toolName: "no_ext_tool",
        args: { file_path: "fileWithoutExtension" },
      },
      {
        toolCallId: "tc-non-string",
        toolName: "num_tool",
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

    // 5. Download tool missing execute or execute is not a function
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
});
