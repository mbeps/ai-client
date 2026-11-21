"use client";

import type * as React from "react";
import { useMemo, useState } from "react";
import { SkillDirectoryModals } from "@/components/skill/skill-directory-modals";
import { SkillDirectoryTreeItem } from "@/components/skill/skill-directory-tree-item";
import { buildSkillTree } from "@/lib/skills/build-skill-tree";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Shared props for skill directory views (picker and sidebar).
 */
export interface SkillDirectoryProps {
  files: SkillBundledFile[];
  selectedPath: string;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string, initialContent?: string) => void;
  onCreateFolder: (folderPath: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFolder: (oldPrefix: string, newPrefix: string) => void;
  onDeleteFolder: (folderPath: string) => void;
  onMoveFile: (sourcePath: string, targetFolder: string) => void;
  emptyFolders?: string[];
  externalMoveFile?: string | null;
  onClearExternalMoveFile?: () => void;
}

/**
 * Props for the SkillDirectoryShell component.
 */
export interface SkillDirectoryShellProps extends SkillDirectoryProps {
  treeClassName: string;
  children: (controls: {
    openNewFileDialog: (folderPath?: string) => void;
    openNewFolderDialog: (parentFolder?: string) => void;
    treeContent: React.ReactNode;
  }) => React.ReactNode;
}

/**
 * Shared state, drag-and-drop tree, and modal controller for skill directory views.
 */
export function SkillDirectoryShell({
  files,
  selectedPath,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onRenameFolder,
  onDeleteFolder,
  onMoveFile,
  emptyFolders = [],
  externalMoveFile,
  onClearExternalMoveFile,
  treeClassName,
  children,
}: SkillDirectoryShellProps) {
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [targetFileParent, setTargetFileParent] = useState("");

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [targetFolderParent, setTargetFolderParent] = useState("");

  const [renameFileDialogOpen, setRenameFileDialogOpen] = useState(false);
  const [fileToRename, setFileToRename] = useState("");

  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState("");

  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState("");

  const [moveFileDialogOpen, setMoveFileDialogOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState("");

  if (
    externalMoveFile &&
    !moveFileDialogOpen &&
    externalMoveFile !== fileToMove
  ) {
    setFileToMove(externalMoveFile);
    setMoveFileDialogOpen(true);
    onClearExternalMoveFile?.();
  }

  const tree = useMemo(
    () => buildSkillTree(files, emptyFolders),
    [files, emptyFolders],
  );

  const openNewFileDialog = (folderPath = "") => {
    setTargetFileParent(folderPath);
    setFileDialogOpen(true);
  };

  const openNewFolderDialog = (parentFolder = "") => {
    setTargetFolderParent(parentFolder);
    setFolderDialogOpen(true);
  };

  const openRenameFileDialog = (oldPath: string) => {
    setFileToRename(oldPath);
    setRenameFileDialogOpen(true);
  };

  const openRenameFolderDialog = (folderPath: string) => {
    setFolderToRename(folderPath);
    setRenameFolderDialogOpen(true);
  };

  const openDeleteFolderDialog = (folderPath: string) => {
    setFolderToDelete(folderPath);
    setDeleteFolderDialogOpen(true);
  };

  const openMoveFileDialog = (filePath: string) => {
    setFileToMove(filePath);
    setMoveFileDialogOpen(true);
  };

  const treeContent = (
    <div
      className={treeClassName}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const source = e.dataTransfer.getData("text/plain");
        if (source) {
          onMoveFile(source, "");
        }
      }}
    >
      {tree.map((node) => (
        <SkillDirectoryTreeItem
          key={node.id}
          node={node}
          selectedPath={selectedPath}
          onSelect={onSelectFile}
          onNewFile={openNewFileDialog}
          onNewFolder={openNewFolderDialog}
          onRenameFile={openRenameFileDialog}
          onDeleteFile={onDeleteFile}
          onRenameFolder={openRenameFolderDialog}
          onDeleteFolder={openDeleteFolderDialog}
          onRequestMoveFile={openMoveFileDialog}
          onMoveFile={onMoveFile}
        />
      ))}
    </div>
  );

  return (
    <>
      {children({
        openNewFileDialog,
        openNewFolderDialog,
        treeContent,
      })}

      <SkillDirectoryModals
        files={files}
        emptyFolders={emptyFolders}
        fileDialogOpen={fileDialogOpen}
        onCloseFileDialog={() => setFileDialogOpen(false)}
        targetFileParent={targetFileParent}
        onCreateFile={onCreateFile}
        folderDialogOpen={folderDialogOpen}
        onCloseFolderDialog={() => setFolderDialogOpen(false)}
        targetFolderParent={targetFolderParent}
        onCreateFolder={onCreateFolder}
        renameFileDialogOpen={renameFileDialogOpen}
        onCloseRenameFileDialog={() => setRenameFileDialogOpen(false)}
        fileToRename={fileToRename}
        onRenameFile={onRenameFile}
        renameFolderDialogOpen={renameFolderDialogOpen}
        onCloseRenameFolderDialog={() => setRenameFolderDialogOpen(false)}
        folderToRename={folderToRename}
        onRenameFolder={onRenameFolder}
        deleteFolderDialogOpen={deleteFolderDialogOpen}
        onCloseDeleteFolderDialog={() => setDeleteFolderDialogOpen(false)}
        folderToDelete={folderToDelete}
        onDeleteFolder={onDeleteFolder}
        moveFileDialogOpen={moveFileDialogOpen}
        onCloseMoveFileDialog={() => setMoveFileDialogOpen(false)}
        fileToMove={fileToMove}
        onMoveFile={onMoveFile}
      />
    </>
  );
}
