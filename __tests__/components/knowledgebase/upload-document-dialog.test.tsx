import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadDocumentDialog } from "@/components/knowledgebase/upload-document-dialog";

const mockUseUserModels = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: mockUseUserModels,
}));

describe("UploadDocumentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUserModels.mockReturnValue({
      models: [{ id: "model-1", label: "text-embedding-3-small" }],
      isLoading: false,
    });
  });

  it("validates file extension and size before enabling Upload", () => {
    const onUpload = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <UploadDocumentDialog
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    // Unsupported extension
    fireEvent.change(input, {
      target: {
        files: [new File(["data"], "sheet.xlsx", { type: "application/vnd.ms-excel" })],
      },
    });
    expect(
      screen.getByText(
        "Spreadsheets and Office files are not supported. Use PDF, plain text or Markdown.",
      ),
    ).toBeInTheDocument();

    // File exceeding 50 MB
    const oversized = new File(["x"], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: 51 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(screen.getByText("File exceeds the 50 MB limit.")).toBeInTheDocument();
  });

  it("calls onUpload with valid file and closes dialog immediately", () => {
    const onUpload = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <UploadDocumentDialog
        open={true}
        onOpenChange={onOpenChange}
        onUpload={onUpload}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(["hello"], "guide.md", { type: "text/markdown" });
    fireEvent.change(input, { target: { files: [validFile] } });

    expect(screen.getByText("guide.md")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^upload$/i }));

    expect(onUpload).toHaveBeenCalledWith(validFile);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows warning and disables Upload when no embedding models are configured", () => {
    mockUseUserModels.mockReturnValue({
      models: [],
      isLoading: false,
    });

    render(
      <UploadDocumentDialog
        open={true}
        onOpenChange={vi.fn()}
        onUpload={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "No embedding models configured. Please set up a provider first.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^upload$/i })).toBeDisabled();
  });
});
