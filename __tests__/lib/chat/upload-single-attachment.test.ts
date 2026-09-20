import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpload = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/actions/attachments/upload-attachment", () => ({
  uploadAttachment: mockUpload,
}));
vi.mock("sonner", () => ({ toast: mockToast }));
vi.mock("@/lib/logger", () => {
  const mockLog = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
  return { getLogger: vi.fn(() => mockLog), logger: mockLog };
});

import { uploadSingleAttachment } from "@/lib/chat/attachments/upload-single-attachment";
import type { Attachment } from "@/types/attachment/attachment";

const baseAttachment: Attachment = {
  id: "att-1",
  type: "image",
  name: "pic.png",
  mimeType: "image/png",
  sizeBytes: 1024,
  dataUrl: "data:image/png;base64,AAAA",
  rawFile: new File(["x"], "pic.png", { type: "image/png" }),
};

describe("uploadSingleAttachment — blob stripping (F6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload.mockResolvedValue({ key: "uploads/pic.png" });
  });

  it("strips dataUrl and rawFile once the key exists", async () => {
    const result = await uploadSingleAttachment(baseAttachment, "msg-1");

    expect(result).not.toBeNull();
    expect(result!.key).toBe("uploads/pic.png");
    // dataUrl is emptied (type requires the field) and rawFile is removed
    expect(result!.dataUrl).toBe("");
    expect(result).not.toHaveProperty("rawFile");
    // Non-blob fields survive
    expect(result!.id).toBe("att-1");
    expect(result!.name).toBe("pic.png");
  });

  it("falls back to fetch dataUrl and includes extractedText when provided", async () => {
    const mockBlob = new Blob(["test"], { type: "text/plain" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      blob: vi.fn().mockResolvedValue(mockBlob),
    }));

    const result = await uploadSingleAttachment(
      {
        id: "att-2",
        type: "document",
        name: "doc.txt",
        mimeType: "text/plain",
        sizeBytes: 4,
        dataUrl: "data:text/plain;base64,dGVzdA==",
        extractedText: "Sample extracted text",
      },
      "msg-2",
    );

    expect(result).not.toBeNull();
    expect(result!.extractedText).toBe("Sample extracted text");
    expect(result!.dataUrl).toBe("");

    vi.unstubAllGlobals();
  });

  it("handles non-Error objects thrown during upload", async () => {
    mockUpload.mockRejectedValueOnce("Upload service down");

    const result = await uploadSingleAttachment(baseAttachment, "msg-1");
    expect(result).toBeNull();
    expect(mockToast.error).toHaveBeenCalledWith(
      'Failed to upload "pic.png". It will not be sent to the AI.',
    );
  });
});
