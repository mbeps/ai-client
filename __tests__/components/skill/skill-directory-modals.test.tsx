import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillDirectoryModals } from "@/components/skill/skill-directory-modals";

describe("SkillDirectoryModals", () => {
  const defaultProps = {
    files: [],
    fileDialogOpen: false,
    onCloseFileDialog: vi.fn(),
    targetFileParent: "",
    onCreateFile: vi.fn(),
    folderDialogOpen: false,
    onCloseFolderDialog: vi.fn(),
    targetFolderParent: "",
    onCreateFolder: vi.fn(),
    renameFileDialogOpen: false,
    onCloseRenameFileDialog: vi.fn(),
    fileToRename: "test.md",
    onRenameFile: vi.fn(),
    renameFolderDialogOpen: false,
    onCloseRenameFolderDialog: vi.fn(),
    folderToRename: "docs",
    onRenameFolder: vi.fn(),
    deleteFolderDialogOpen: false,
    onCloseDeleteFolderDialog: vi.fn(),
    folderToDelete: "docs",
    onDeleteFolder: vi.fn(),
    moveFileDialogOpen: false,
    onCloseMoveFileDialog: vi.fn(),
    fileToMove: "test.md",
    onMoveFile: vi.fn(),
  };

  it("renders Create File dialog with Cancel and Create File buttons", () => {
    render(<SkillDirectoryModals {...defaultProps} fileDialogOpen={true} />);

    expect(screen.getByRole("heading", { name: "New File" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create file/i })).toBeInTheDocument();
  });

  it("renders Create Folder dialog with Cancel and Create Folder buttons", () => {
    render(<SkillDirectoryModals {...defaultProps} folderDialogOpen={true} />);

    expect(screen.getByRole("heading", { name: "New Folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create folder/i })).toBeInTheDocument();
  });

  it("renders Delete Folder dialog via DeleteConfirmDialog", () => {
    render(
      <SkillDirectoryModals
        {...defaultProps}
        deleteFolderDialogOpen={true}
        folderToDelete="scripts"
      />,
    );

    expect(
      screen.getByText('Delete Folder "scripts"?'),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete folder/i })).toBeInTheDocument();
  });

  it("renders Move File dialog with Cancel and Move File buttons", () => {
    render(<SkillDirectoryModals {...defaultProps} moveFileDialogOpen={true} />);

    expect(screen.getByRole("heading", { name: "Move File" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move file/i })).toBeInTheDocument();
  });
});
