import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadFile,
  extractFilenameFromUrl,
} from "@/lib/utils/download-file";

describe("download-file utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("extractFilenameFromUrl", () => {
    it("extracts clean filename from standard URL pathname", () => {
      expect(
        extractFilenameFromUrl("https://example.com/reports/financials.xlsx"),
      ).toBe("financials.xlsx");
    });

    it("strips query parameters and hashes", () => {
      expect(
        extractFilenameFromUrl(
          "https://example.com/files/chart.png?auth=token&exp=123#section",
        ),
      ).toBe("chart.png");
    });

    it("decodes URL encoded segments", () => {
      expect(
        extractFilenameFromUrl("https://example.com/docs/Annual%20Report.pdf"),
      ).toBe("Annual Report.pdf");
    });

    it("returns fallback if last pathname segment is empty", () => {
      expect(extractFilenameFromUrl("https://example.com/", "default.txt")).toBe(
        "default.txt",
      );
      expect(extractFilenameFromUrl("https://example.com")).toBe("download");
    });

    it("falls back to regex matching if new URL throws", () => {
      // In WHATWG URL, malformed brackets in hostname throw TypeError
      const malformedUrl = "http://[invalid-ipv6/exports/data.csv?token=123";
      expect(extractFilenameFromUrl(malformedUrl)).toBe("data.csv");
    });

    it("returns fallback if URL parsing throws and regex finds no match", () => {
      vi.spyOn(globalThis, "URL").mockImplementationOnce(() => {
        throw new Error("Invalid URL");
      });
      expect(extractFilenameFromUrl("noslashes", "my-fallback")).toBe(
        "my-fallback",
      );
    });
  });

  describe("downloadFile", () => {
    it("returns early if window is undefined (SSR)", async () => {
      vi.stubGlobal("window", undefined);
      await expect(
        downloadFile("https://example.com/test.csv"),
      ).resolves.toBeUndefined();
    });

    it("returns early if url is empty", async () => {
      await expect(downloadFile("")).resolves.toBeUndefined();
    });

    it("triggers direct anchor download for blob URLs", async () => {
      const appendSpy = vi.spyOn(document.body, "appendChild");
      const removeSpy = vi.spyOn(document.body, "removeChild");

      await downloadFile("blob:http://localhost/12345", "test.txt");

      expect(appendSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchor.href).toBe("blob:http://localhost/12345");
      expect(anchor.download).toBe("test.txt");
    });

    it("triggers direct anchor download for data URLs", async () => {
      const appendSpy = vi.spyOn(document.body, "appendChild");
      const removeSpy = vi.spyOn(document.body, "removeChild");

      await downloadFile("data:text/plain;base64,SGVsbG8=", "hello.txt");

      expect(appendSpy).toHaveBeenCalled();
      expect(removeSpy).toHaveBeenCalled();
      const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchor.href).toBe("data:text/plain;base64,SGVsbG8=");
      expect(anchor.download).toBe("hello.txt");
    });

    it("fetches resource as blob and triggers anchor download on success", async () => {
      const mockBlob = new Blob(["sample content"], { type: "text/csv" });
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      });
      vi.stubGlobal("fetch", mockFetch);

      const createObjectUrlSpy = vi
        .spyOn(window.URL, "createObjectURL")
        .mockReturnValue("blob:download-blob-123");
      const revokeObjectUrlSpy = vi
        .spyOn(window.URL, "revokeObjectURL")
        .mockImplementation(() => {});
      const appendSpy = vi.spyOn(document.body, "appendChild");

      await downloadFile("https://example.com/data.csv", "custom.csv");

      expect(mockFetch).toHaveBeenCalledWith("https://example.com/data.csv", {
        method: "GET",
        mode: "cors",
      });
      expect(createObjectUrlSpy).toHaveBeenCalledWith(mockBlob);
      expect(revokeObjectUrlSpy).toHaveBeenCalledWith("blob:download-blob-123");
      const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchor.href).toBe("blob:download-blob-123");
      expect(anchor.download).toBe("custom.csv");
    });

    it("infers filename from URL when filename parameter is omitted", async () => {
      const mockBlob = new Blob(["sample content"], { type: "text/csv" });
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      });
      vi.stubGlobal("fetch", mockFetch);
      const appendSpy = vi.spyOn(document.body, "appendChild");

      await downloadFile("https://example.com/assets/auto_named.json");

      const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchor.download).toBe("auto_named.json");
    });

    it("falls back to anchor tag opening in new tab when fetch returns non-ok response", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Forbidden",
      });
      vi.stubGlobal("fetch", mockFetch);
      const appendSpy = vi.spyOn(document.body, "appendChild");

      await downloadFile("https://s3.amazonaws.com/cors-blocked.pdf", "cors.pdf");

      const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchor.target).toBe("_blank");
      expect(anchor.rel).toBe("noopener noreferrer");
      expect(anchor.href).toBe("https://s3.amazonaws.com/cors-blocked.pdf");
      expect(anchor.download).toBe("cors.pdf");
    });

    it("falls back to anchor tag opening in new tab when fetch throws (e.g. CORS error)", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
      vi.stubGlobal("fetch", mockFetch);
      const appendSpy = vi.spyOn(document.body, "appendChild");

      await downloadFile("https://s3.amazonaws.com/cors-blocked.pdf", "cors.pdf");

      const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchor.target).toBe("_blank");
      expect(anchor.rel).toBe("noopener noreferrer");
      expect(anchor.href).toBe("https://s3.amazonaws.com/cors-blocked.pdf");
      expect(anchor.download).toBe("cors.pdf");
    });
  });
});

