import { describe, expect, it, vi } from "vitest";
import { cloneAttachments } from "@/lib/chat/attachments/clone-attachments";
import type { Attachment } from "@/types/attachment/attachment";

const mockCloneAttachmentsBatch = vi.fn();
const mockToastError = vi.fn();
const mockLogError = vi.fn();

vi.mock("@/actions/attachments/clone-attachments-batch", () => ({
  cloneAttachmentsBatch: (...args: unknown[]) => mockCloneAttachmentsBatch(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    error: (...args: unknown[]) => mockLogError(...args),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("cloneAttachments", () => {
  it("returns empty array when attachments have no key", async () => {
    const atts = [{ id: "1", name: "test.txt", type: "file" }] as Attachment[];
    const res = await cloneAttachments(atts, "msg-2");
    expect(res).toEqual([]);
    expect(mockCloneAttachmentsBatch).not.toHaveBeenCalled();
  });

  it("clones attachments successfully and preserves original extractedText when result extractedText is null", async () => {
    mockCloneAttachmentsBatch.mockResolvedValueOnce([
      { id: "new-1", key: "key-1", extractedText: null },
      { id: "new-2", key: "key-2", extractedText: "override text" },
    ]);

    const atts = [
      { id: "1", key: "key-1", name: "doc1.txt", extractedText: "orig text" },
      { id: "2", key: "key-2", name: "doc2.txt", extractedText: "orig text 2" },
    ] as Attachment[];

    const res = await cloneAttachments(atts, "msg-2");
    expect(res).toHaveLength(2);
    expect(res[0].id).toBe("new-1");
    expect(res[0].extractedText).toBe("orig text");
    expect(res[1].id).toBe("new-2");
    expect(res[1].extractedText).toBe("override text");
  });

  it("handles Error instances in catch block", async () => {
    mockCloneAttachmentsBatch.mockRejectedValueOnce(new Error("Batch failure"));

    const atts = [{ id: "1", key: "key-1", name: "doc1.txt" }] as Attachment[];
    const res = await cloneAttachments(atts, "msg-2");

    expect(res).toEqual([]);
    expect(mockLogError).toHaveBeenCalledWith(
      "Attachment batch clone failed: {error}",
      { error: "Batch failure" },
    );
    expect(mockToastError).toHaveBeenCalledWith(
      "Failed to clone attachments. They will not be sent to the AI.",
    );
  });

  it("handles non-Error objects in catch block", async () => {
    mockCloneAttachmentsBatch.mockRejectedValueOnce("Plain string error");

    const atts = [{ id: "1", key: "key-1", name: "doc1.txt" }] as Attachment[];
    const res = await cloneAttachments(atts, "msg-2");

    expect(res).toEqual([]);
    expect(mockLogError).toHaveBeenCalledWith(
      "Attachment batch clone failed: {error}",
      { error: "Plain string error" },
    );
  });
});

