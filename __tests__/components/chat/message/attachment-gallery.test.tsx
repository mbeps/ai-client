import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Attachment } from "@/types/attachment/attachment";

const mockGetAttachmentUrl = vi.hoisted(() => vi.fn());
const mockDownloadFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/actions/attachments/get-attachment-url", () => ({
  getAttachmentUrl: mockGetAttachmentUrl,
}));
vi.mock("@/lib/utils/download-file", () => ({
  downloadFile: mockDownloadFile,
}));

import { AttachmentGallery } from "@/components/chat/message/attachment-gallery";

describe("AttachmentGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when attachments array is empty", () => {
    const { container } = render(<AttachmentGallery attachments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders image immediately if attachment has dataUrl", () => {
    const att: Attachment = {
      id: "att-1",
      type: "image",
      name: "cover.png",
      mimeType: "image/png",
      sizeBytes: 1024,
      dataUrl: "data:image/png;base64,test-image-data",
    };

    render(<AttachmentGallery attachments={[att]} />);

    const img = screen.getByAltText("cover.png");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "data:image/png;base64,test-image-data");
    expect(mockGetAttachmentUrl).not.toHaveBeenCalled();
  });

  it("fetches URL and renders image when dataUrl is empty but key exists", async () => {
    const att: Attachment = {
      id: "att-2",
      type: "image",
      name: "cover.png",
      mimeType: "image/png",
      sizeBytes: 2048,
      dataUrl: "",
      key: "attachments/user-1/att-2-cover.png",
    };

    mockGetAttachmentUrl.mockResolvedValueOnce({
      url: "data:image/png;base64,resolved-image-data",
      name: "cover.png",
      mimeType: "image/png",
    });

    render(<AttachmentGallery attachments={[att]} />);

    // Initially loading skeleton
    expect(screen.queryByAltText("cover.png")).toBeNull();

    // After resolve, image appears
    await waitFor(() => {
      const img = screen.getByAltText("cover.png");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "data:image/png;base64,resolved-image-data");
    });

    expect(mockGetAttachmentUrl).toHaveBeenCalledWith("att-2");
  });

  it("renders document attachment as download chip", async () => {
    const docAtt: Attachment = {
      id: "att-doc-1",
      type: "document",
      name: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 5000,
      dataUrl: "",
      key: "attachments/user-1/att-doc-1-report.pdf",
    };

    mockGetAttachmentUrl.mockResolvedValueOnce({
      url: "https://s3.example.com/report.pdf",
      name: "report.pdf",
      mimeType: "application/pdf",
    });

    render(<AttachmentGallery attachments={[docAtt]} />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /report\.pdf/i });
      expect(link).toHaveAttribute("href", "https://s3.example.com/report.pdf");
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  it("renders spreadsheet attachment with spreadsheet icon and link", async () => {
    const sheetAtt: Attachment = {
      id: "att-sheet-1",
      type: "spreadsheet",
      name: "data.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 10000,
      dataUrl: "",
      key: "attachments/user-1/att-sheet-1-data.xlsx",
    };

    mockGetAttachmentUrl.mockResolvedValueOnce({
      url: "https://s3.example.com/data.xlsx",
      name: "data.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    render(<AttachmentGallery attachments={[sheetAtt]} />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /data\.xlsx/i });
      expect(link).toHaveAttribute("href", "https://s3.example.com/data.xlsx");
    });
  });

  it("triggers downloadFile when document link is clicked", async () => {
    const docAtt: Attachment = {
      id: "att-doc-2",
      type: "document",
      name: "report.pdf",
      mimeType: "application/pdf",
      sizeBytes: 5000,
      url: "https://s3.example.com/report.pdf",
    };

    render(<AttachmentGallery attachments={[docAtt]} />);

    const link = screen.getByRole("link", { name: /report\.pdf/i });
    await act(async () => {
      fireEvent.click(link);
    });

    expect(mockDownloadFile).toHaveBeenCalledWith(
      "https://s3.example.com/report.pdf",
      "report.pdf",
    );
  });
});

