import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockProcessAttachment, mockToastError } = vi.hoisted(() => ({
  mockProcessAttachment: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/lib/attachments/process-attachment", () => ({
  processAttachment: mockProcessAttachment,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mockToastError,
  },
}));

import { useChatAttachments } from "@/components/chat/input/use-chat-attachments";

describe("useChatAttachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles adding files, vision unsupported, processAttachment errors (Error and non-Error), and remove/clear", async () => {
    const onVisionUnsupported = vi.fn();
    mockProcessAttachment
      .mockResolvedValueOnce({ id: "a1", name: "doc.txt", type: "document" })
      .mockRejectedValueOnce(new Error("Bad file"))
      .mockRejectedValueOnce("string error");

    const { result, unmount } = renderHook(() =>
      useChatAttachments({
        supportsVision: false,
        onVisionUnsupported,
      }),
    );

    const imgFile = new File(["img"], "pic.png", { type: "image/png" });
    const txtFile = new File(["txt"], "doc.txt", { type: "text/plain" });
    const badFile1 = new File(["bad1"], "bad1.txt", { type: "text/plain" });
    const badFile2 = new File(["bad2"], "bad2.txt", { type: "text/plain" });

    await act(async () => {
      await result.current.addFiles([imgFile, txtFile, badFile1, badFile2]);
    });

    expect(onVisionUnsupported).toHaveBeenCalledTimes(1);
    expect(mockToastError).toHaveBeenCalledWith("Bad file");
    expect(mockToastError).toHaveBeenCalledWith("Failed to process file");
    expect(result.current.attachments).toHaveLength(1);

    // Empty addFiles (no newAttachments)
    await act(async () => {
      await result.current.addFiles([imgFile]);
    });
    expect(result.current.attachments).toHaveLength(1);

    // removeAttachment & clearAttachments
    act(() => {
      result.current.removeAttachment("a1");
    });
    expect(result.current.attachments).toHaveLength(0);

    act(() => {
      result.current.clearAttachments();
    });
    expect(result.current.attachments).toHaveLength(0);

    unmount();
  });

  it("handles file input change and drag-and-drop events", async () => {
    mockProcessAttachment.mockResolvedValue({ id: "a2", name: "drop.png", type: "image" });
    const { result, unmount } = renderHook(() =>
      useChatAttachments({
        supportsVision: true,
        onVisionUnsupported: vi.fn(),
      }),
    );

    const file = new File(["x"], "drop.png", { type: "image/png" });

    // handleFileInputChange with files and without files
    await act(async () => {
      result.current.handleFileInputChange({
        target: { files: [file], value: "c:\\fakepath\\drop.png" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });
    expect(result.current.attachments).toHaveLength(1);

    act(() => {
      result.current.handleFileInputChange({
        target: { files: null, value: "" },
      } as unknown as React.ChangeEvent<HTMLInputElement>);
    });

    // dragOver, dragLeave, drop (with and without files)
    const preventDefault = vi.fn();
    act(() => {
      result.current.handleDragOver({ preventDefault } as unknown as React.DragEvent);
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.handleDragLeave({ preventDefault } as unknown as React.DragEvent);
    });
    expect(result.current.isDragging).toBe(false);

    await act(async () => {
      result.current.handleDrop({
        preventDefault,
        dataTransfer: { files: [file] },
      } as unknown as React.DragEvent);
    });
    expect(result.current.attachments).toHaveLength(2);

    act(() => {
      result.current.handleDrop({
        preventDefault,
        dataTransfer: { files: [] },
      } as unknown as React.DragEvent);
    });

    unmount();
  });
});
