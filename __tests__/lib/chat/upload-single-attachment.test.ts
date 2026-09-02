import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpload = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/lib/actions/attachments/upload-attachment", () => ({
  uploadAttachment: mockUpload,
}));
vi.mock("sonner", () => ({ toast: mockToast }));
vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

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
});
