import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SkillBundleUploader } from "@/components/skill/skill-bundle-uploader";

const mockToast = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

describe("SkillBundleUploader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles file selection via input, drag-and-drop, invalid extension, and upload", async () => {
    const onUpload = vi.fn(async () => {});
    const onCancel = vi.fn();

    const { container } = render(
      <SkillBundleUploader onUpload={onUpload} onCancel={onCancel} />,
    );

    const dropzone = container.querySelector(".border-dashed") as HTMLElement;
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click").mockImplementation(() => {});

    fireEvent.click(dropzone);
    expect(clickSpy).toHaveBeenCalled();

    // Drag over & drag leave
    fireEvent.dragOver(dropzone);
    fireEvent.dragLeave(dropzone);

    // Drop empty files
    fireEvent.drop(dropzone, { dataTransfer: { files: [] } });

    // Drop invalid file
    const badFile = new File(["bad"], "bad.png", { type: "image/png" });
    fireEvent.drop(dropzone, { dataTransfer: { files: [badFile] } });
    expect(mockToast.error).toHaveBeenCalledWith(
      "Please select a .md markdown file or a .zip skill bundle.",
    );

    // Select .md file via input
    const mdFile = new File(["# Skill"], "SKILL.md", { type: "text/markdown" });
    fireEvent.change(fileInput, { target: { files: [mdFile] } });
    expect(screen.getAllByText("SKILL.md").length).toBeGreaterThan(1);

    // Change file via input with empty files
    fireEvent.change(fileInput, { target: { files: [] } });

    // Remove file
    fireEvent.click(dropzone.querySelector("button")!);
    expect(screen.getAllByText("SKILL.md")).toHaveLength(1);

    // Drop .zip file
    const zipFile = new File(["zip"], "bundle.zip", { type: "application/zip" });
    fireEvent.drop(dropzone, { dataTransfer: { files: [zipFile] } });
    expect(screen.getByText("bundle.zip")).toBeInTheDocument();

    // Upload
    fireEvent.click(screen.getByRole("button", { name: /import skill/i }));
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(zipFile));

    // Cancel
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("renders uploading state", () => {
    render(
      <SkillBundleUploader
        onUpload={vi.fn()}
        onCancel={vi.fn()}
        isUploading={true}
      />,
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });
});
