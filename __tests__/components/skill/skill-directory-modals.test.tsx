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

  it("validates and submits Create File dialog", () => {
    const onCreateFile = vi.fn();
    const onCloseFileDialog = vi.fn();
    render(
      <SkillDirectoryModals
        {...defaultProps}
        files={[{ path: "docs/existing.md" }] as any}
        fileDialogOpen={true}
        targetFileParent="docs"
        onCreateFile={onCreateFile}
        onCloseFileDialog={onCloseFileDialog}
      />,
    );

    const input = screen.getByRole("textbox");
    // Empty submit
    fireEvent.click(screen.getByRole("button", { name: /create file/i }));
    expect(onCreateFile).not.toHaveBeenCalled();

    // Duplicate file
    fireEvent.change(input, { target: { value: "existing.md" } });
    fireEvent.click(screen.getByRole("button", { name: /create file/i }));
    expect(onCreateFile).not.toHaveBeenCalled();

    // Valid file
    fireEvent.change(input, { target: { value: "new.md" } });
    fireEvent.click(screen.getByRole("button", { name: /create file/i }));
    expect(onCreateFile).toHaveBeenCalledWith("docs/new.md", expect.any(String));
    expect(onCloseFileDialog).toHaveBeenCalled();
  });

  it("validates and submits Create Folder dialog", () => {
    const onCreateFolder = vi.fn();
    const onCloseFolderDialog = vi.fn();
    render(
      <SkillDirectoryModals
        {...defaultProps}
        folderDialogOpen={true}
        targetFolderParent="docs"
        onCreateFolder={onCreateFolder}
        onCloseFolderDialog={onCloseFolderDialog}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.click(screen.getByRole("button", { name: /create folder/i }));
    expect(onCreateFolder).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "sub" } });
    fireEvent.click(screen.getByRole("button", { name: /create folder/i }));
    expect(onCreateFolder).toHaveBeenCalledWith("docs/sub");
    expect(onCloseFolderDialog).toHaveBeenCalled();
  });

  it("validates and submits Rename File dialog", () => {
    const onRenameFile = vi.fn();
    const onCloseRenameFileDialog = vi.fn();
    render(
      <SkillDirectoryModals
        {...defaultProps}
        files={[{ path: "docs/existing.md" }] as any}
        renameFileDialogOpen={true}
        fileToRename="docs/test.md"
        onRenameFile={onRenameFile}
        onCloseRenameFileDialog={onCloseRenameFileDialog}
      />,
    );

    const input = screen.getByRole("textbox");

    // Empty name
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));

    // Duplicate name
    fireEvent.change(input, { target: { value: "existing.md" } });
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));

    // Invalid path
    fireEvent.change(input, { target: { value: "../bad.md" } });
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));

    // Unchanged name
    fireEvent.change(input, { target: { value: "test.md" } });
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(onCloseRenameFileDialog).toHaveBeenCalled();

    // Valid rename
    fireEvent.change(input, { target: { value: "renamed.md" } });
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(onRenameFile).toHaveBeenCalled();
  });

  it("validates and submits Rename Folder dialog", () => {
    const onRenameFolder = vi.fn();
    const onCloseRenameFolderDialog = vi.fn();
    render(
      <SkillDirectoryModals
        {...defaultProps}
        renameFolderDialogOpen={true}
        folderToRename="docs/sub"
        onRenameFolder={onRenameFolder}
        onCloseRenameFolderDialog={onCloseRenameFolderDialog}
      />,
    );

    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));

    fireEvent.change(input, { target: { value: "newsub" } });
    fireEvent.click(screen.getByRole("button", { name: /rename/i }));
    expect(onRenameFolder).toHaveBeenCalledWith("docs/sub", "newsub");
    expect(onCloseRenameFolderDialog).toHaveBeenCalled();
  });

  it("submits Delete Folder and Move File dialogs", () => {
    const onDeleteFolder = vi.fn();
    const onCloseDeleteFolderDialog = vi.fn();
    const onMoveFile = vi.fn();
    const onCloseMoveFileDialog = vi.fn();

    render(
      <SkillDirectoryModals
        {...defaultProps}
        deleteFolderDialogOpen={true}
        folderToDelete="scripts"
        onDeleteFolder={onDeleteFolder}
        onCloseDeleteFolderDialog={onCloseDeleteFolderDialog}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /delete folder/i }));
    expect(onDeleteFolder).toHaveBeenCalledWith("scripts");
    expect(onCloseDeleteFolderDialog).toHaveBeenCalled();

    render(
      <SkillDirectoryModals
        {...defaultProps}
        moveFileDialogOpen={true}
        fileToMove="docs/test.md"
        onMoveFile={onMoveFile}
        onCloseMoveFileDialog={onCloseMoveFileDialog}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /move file/i }));
    expect(onMoveFile).toHaveBeenCalled();
    expect(onCloseMoveFileDialog).toHaveBeenCalled();
  });

  it("handles validation errors, Enter keydowns, folder selection, and move errors", () => {
    const onMoveFile = vi.fn(() => {
      throw new Error("Move failed");
    });
    const onCloseFileDialog = vi.fn();
    const onCloseFolderDialog = vi.fn();
    const onCloseRenameFileDialog = vi.fn();
    const onCloseRenameFolderDialog = vi.fn();
    const onCloseMoveFileDialog = vi.fn();

    // 1. Create File: SKILL.md error
    const { unmount: u1 } = render(
      <SkillDirectoryModals
        {...defaultProps}
        fileDialogOpen={true}
        onCloseFileDialog={onCloseFileDialog}
      />,
    );
    const fileInput = screen.getByRole("textbox");
    fireEvent.change(fileInput, { target: { value: "SKILL.md" } });
    fireEvent.click(screen.getByRole("button", { name: /create file/i }));
    fireEvent.keyDown(document.querySelector('[role="dialog"]')!, { key: "Escape" });
    u1();

    // 2. Create Folder: Enter keydown
    const { unmount: u2 } = render(
      <SkillDirectoryModals
        {...defaultProps}
        folderDialogOpen={true}
        targetFolderParent="docs"
        onCloseFolderDialog={onCloseFolderDialog}
      />,
    );
    const folderInput = screen.getByPlaceholderText(/references, scripts, or assets/i);
    fireEvent.change(folderInput, { target: { value: "sub" } });
    fireEvent.keyDown(folderInput, { key: "Enter" });
    u2();

    // 3. Rename File: SKILL.md error, existing file error, empty path, Enter keydown
    const { unmount: u3 } = render(
      <SkillDirectoryModals
        {...defaultProps}
        renameFileDialogOpen={true}
        fileToRename="docs/test.md"
        files={[
          { path: "docs/test.md", content: "" },
          { path: "docs/other.md", content: "" },
        ]}
        onCloseRenameFileDialog={onCloseRenameFileDialog}
      />,
    );
    const renameFileInput = screen.getByDisplayValue("docs/test.md");
    fireEvent.change(renameFileInput, { target: { value: "SKILL.md" } });
    fireEvent.keyDown(renameFileInput, { key: "Enter" });
    fireEvent.change(renameFileInput, { target: { value: "docs/other.md" } });
    fireEvent.click(screen.getByRole("button", { name: /^rename$/i }));
    u3();

    // 4. Rename Folder: empty path, Enter keydown
    const { unmount: u4 } = render(
      <SkillDirectoryModals
        {...defaultProps}
        renameFolderDialogOpen={true}
        folderToRename=""
        onCloseRenameFolderDialog={onCloseRenameFolderDialog}
      />,
    );
    const renameFolderInput = screen.getByDisplayValue("");
    fireEvent.keyDown(renameFolderInput, { key: "Enter" });
    u4();

    // 5. Move File: select available folder, type in input, Enter keydown, and catch error
    render(
      <SkillDirectoryModals
        {...defaultProps}
        moveFileDialogOpen={true}
        fileToMove="docs/test.md"
        availableFolders={["scripts"]}
        onMoveFile={onMoveFile}
        onCloseMoveFileDialog={onCloseMoveFileDialog}
      />,
    );
    const scriptsBtn = screen.queryByRole("button", { name: /scripts/i });
    if (scriptsBtn) fireEvent.click(scriptsBtn);
    const moveInput = screen.getByPlaceholderText(/e\.g\. references, scripts\/utils/i);
    fireEvent.change(moveInput, { target: { value: "assets" } });
    fireEvent.keyDown(moveInput, { key: "Enter" });
    expect(onMoveFile).toHaveBeenCalledWith("docs/test.md", "assets");
  });
});
