import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillDirectoryShell } from "@/components/skill/skill-directory-shell";

describe("SkillDirectoryShell", () => {
  it("renders treeContent, opens dialogs, and handles root drag-and-drop", () => {
    const onMoveFile = vi.fn();
    const { container } = render(
      <SkillDirectoryShell
        files={[{ path: "SKILL.md" }, { path: "docs/readme.md" }] as any}
        emptyFolders={["empty-dir"]}
        selectedPath="SKILL.md"
        onSelectFile={vi.fn()}
        onCreateFile={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onMoveFile={onMoveFile}
      >
        {({ openNewFileDialog, openNewFolderDialog, treeContent }) => (
          <div>
            <button type="button" onClick={() => openNewFileDialog("")}>
              New File Trigger
            </button>
            <button type="button" onClick={() => openNewFolderDialog("")}>
              New Folder Trigger
            </button>
            {treeContent}
          </div>
        )}
      </SkillDirectoryShell>,
    );

    fireEvent.click(screen.getByText("New File Trigger"));
    expect(screen.getByRole("heading", { name: "New File" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    fireEvent.click(screen.getByText("New Folder Trigger"));
    expect(screen.getByRole("heading", { name: "New Folder" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    const dropZone = container.querySelector(".space-y-0\\.5") ?? container.firstElementChild?.querySelector("div");
    if (dropZone) {
      fireEvent.dragOver(dropZone, { dataTransfer: { dropEffect: "" } });
      fireEvent.drop(dropZone, {
        dataTransfer: { getData: () => "docs/readme.md" },
      });
      expect(onMoveFile).toHaveBeenCalledWith("docs/readme.md", "");

      fireEvent.drop(dropZone, {
        dataTransfer: { getData: () => "" },
      });
    }

    const menuTriggers = container.querySelectorAll('button[aria-haspopup="menu"]');
    fireEvent.pointerDown(menuTriggers[0]);
    fireEvent.click(menuTriggers[0]);
    fireEvent.click(screen.getByText("Rename Folder"));
    expect(screen.getByRole("heading", { name: "Rename Folder" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    fireEvent.pointerDown(menuTriggers[0]);
    fireEvent.click(menuTriggers[0]);
    fireEvent.click(screen.getByText("Delete Folder"));
    expect(screen.getByRole("heading", { name: /delete folder/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    fireEvent.pointerDown(menuTriggers[1]);
    fireEvent.click(menuTriggers[1]);
    fireEvent.click(screen.getByText("Move to..."));
    expect(screen.getByRole("heading", { name: /move file/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    fireEvent.pointerDown(menuTriggers[1]);
    fireEvent.click(menuTriggers[1]);
    fireEvent.click(screen.getByText("Rename"));
    expect(screen.getByRole("heading", { name: "Rename File" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
  }, 15000);
});
