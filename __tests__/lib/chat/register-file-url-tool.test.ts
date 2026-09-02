import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPresignedUrl = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/get-presigned-url", () => ({
  getPresignedUrl: mockGetPresignedUrl,
}));

import { registerFileUrlTool } from "@/lib/chat/register-file-url-tool";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerFileUrlTool", () => {
  it("registers a get_file_url tool", () => {
    const tools = registerFileUrlTool([
      { id: "a1", name: "data.xlsx", key: "u/data.xlsx", type: "spreadsheet" },
    ]);

    expect(tools.get_file_url).toBeDefined();
  });

  it("advertises a non-empty inputSchema with fileName", () => {
    const tools = registerFileUrlTool([]);
    const tool = tools.get_file_url as any;

    expect(tool.inputSchema).toBeDefined();
    expect("fileName" in (tool.inputSchema.shape ?? {})).toBe(true);
  });

  it("returns a presigned url for a known file name", async () => {
    mockGetPresignedUrl.mockResolvedValue("https://example.com/signed");
    const tools = registerFileUrlTool([
      { id: "a1", name: "data.xlsx", key: "u/data.xlsx", type: "spreadsheet" },
    ]);

    const result = await (tools.get_file_url as any).execute({
      fileName: "data.xlsx",
    });

    expect(mockGetPresignedUrl).toHaveBeenCalledWith("u/data.xlsx");
    expect(result).toEqual({ url: "https://example.com/signed" });
  });

  it("returns an error for an unknown file name", async () => {
    const tools = registerFileUrlTool([]);

    const result = await (tools.get_file_url as any).execute({
      fileName: "nope.csv",
    });

    expect(result).toEqual({ error: "File not found" });
    expect(mockGetPresignedUrl).not.toHaveBeenCalled();
  });
});
