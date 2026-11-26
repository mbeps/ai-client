import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillDirectoryTreeItem } from "@/components/skill/skill-directory-tree-item";
import type { SkillTreeNode } from "@/lib/skill/directory-utils";

describe("SkillDirectoryTreeItem", () => {
  const folderNode: SkillTreeNode = {
    id: "folder:docs",
    name: "docs",
    path: "docs",
    type: "folder",
    children: [
      {
        id: "file:docs/guide.md",
        name: "guide.md",
        path: "docs/guide.md",
        type: "file",
        isRootSkillMd: false,
      },
    ],
  };

  it("renders folder, toggles open/close, and handles drag-and-drop", () => {
    const onMoveFile = vi.fn();
    render(
      <SkillDirectoryTreeItem
        node={folderNode}
        selectedPath="docs/guide.md"
        onSelect={vi.fn()}
        onNewFile={vi.fn()}
        onNewFolder={vi.fn()}
        onRenameFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onRequestMoveFile={vi.fn()}
        onMoveFile={onMoveFile}
      />,
    );

    const folderBtn = screen.getByRole("button", { name: /docs/i });
    const row = folderBtn.parentElement!;
    fireEvent.dragOver(row);
    fireEvent.dragLeave(row);
    fireEvent.drop(row, {
      dataTransfer: { getData: () => "other.md" },
    });
    expect(onMoveFile).toHaveBeenCalledWith("other.md", "docs");

    // Toggle folder closed and open
    fireEvent.click(folderBtn);
    expect(screen.queryByText("guide.md")).not.toBeInTheDocument();
    fireEvent.click(folderBtn);
    expect(screen.getByText("guide.md")).toBeInTheDocument();

    // Drag start on file
    const fileRow = screen.getByText("guide.md").closest("[draggable]")!;
    const setData = vi.fn();
    fireEvent.dragStart(fileRow, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "docs/guide.md");
  });

  it("triggers folder and file dropdown menu actions and renders fallback/json icons", () => {
    const onNewFile = vi.fn();
    const onNewFolder = vi.fn();
    const onRenameFolder = vi.fn();
    const onDeleteFolder = vi.fn();
    const onRequestMoveFile = vi.fn();
    const onRenameFile = vi.fn();
    const onDeleteFile = vi.fn();

    const richFolder: SkillTreeNode = {
      id: "folder:src",
      name: "src",
      path: "src",
      type: "folder",
      children: [
        {
          id: "file:src/config.json",
          name: "config.json",
          path: "src/config.json",
          type: "file",
          isRootSkillMd: false,
        },
        {
          id: "file:src/asset.bin",
          name: "asset.bin",
          path: "src/asset.bin",
          type: "file",
          isRootSkillMd: false,
        },
      ],
    };

    render(
      <SkillDirectoryTreeItem
        node={richFolder}
        selectedPath="src/config.json"
        onSelect={vi.fn()}
        onNewFile={onNewFile}
        onNewFolder={onNewFolder}
        onRenameFile={onRenameFile}
        onDeleteFile={onDeleteFile}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        onRequestMoveFile={onRequestMoveFile}
        onMoveFile={vi.fn()}
      />,
    );

    const menuButtons = screen.getAllByRole("button", { name: "" });
    // Folder menu actions
    fireEvent.pointerDown(menuButtons[0]);
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText("New File in Folder"));
    expect(onNewFile).toHaveBeenCalledWith("src");

    fireEvent.pointerDown(menuButtons[0]);
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText("New Subfolder"));
    expect(onNewFolder).toHaveBeenCalledWith("src");

    fireEvent.pointerDown(menuButtons[0]);
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText("Rename Folder"));
    expect(onRenameFolder).toHaveBeenCalledWith("src");

    fireEvent.pointerDown(menuButtons[0]);
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText("Delete Folder"));
    expect(onDeleteFolder).toHaveBeenCalledWith("src");

    // File menu actions (first file: config.json)
    fireEvent.pointerDown(menuButtons[1]);
    fireEvent.click(menuButtons[1]);
    fireEvent.click(screen.getByText("Move to..."));
    expect(onRequestMoveFile).toHaveBeenCalledWith("src/config.json");

    fireEvent.pointerDown(menuButtons[1]);
    fireEvent.click(menuButtons[1]);
    fireEvent.click(screen.getByText("Rename"));
    expect(onRenameFile).toHaveBeenCalledWith("src/config.json");

    fireEvent.pointerDown(menuButtons[1]);
    fireEvent.click(menuButtons[1]);
    fireEvent.click(screen.getByText("Delete"));
    expect(onDeleteFile).toHaveBeenCalledWith("src/config.json");
  });

  it("ignores drop on folder when dataTransfer text/plain is empty", () => {
    const onMoveFile = vi.fn();
    render(
      <SkillDirectoryTreeItem
        node={folderNode}
        selectedPath="docs/guide.md"
        onSelect={vi.fn()}
        onNewFile={vi.fn()}
        onNewFolder={vi.fn()}
        onRenameFile={vi.fn()}
        onDeleteFile={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        onRequestMoveFile={vi.fn()}
        onMoveFile={onMoveFile}
      />,
    );

    const folderBtn = screen.getByRole("button", { name: /docs/i });
    const row = folderBtn.parentElement!;
    fireEvent.drop(row, {
      dataTransfer: { getData: () => "" },
    });
    expect(onMoveFile).not.toHaveBeenCalled();
  });
});
