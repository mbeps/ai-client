"use client";

import { FilePlus, Files, FolderPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { SkillDirectoryModals } from "@/components/skill/skill-directory-modals";
import { SkillDirectoryTreeItem } from "@/components/skill/skill-directory-tree-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildSkillTree } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

export interface SkillDirectorySidebarProps {
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
 * Sidebar component displaying the hierarchical directory structure of an Agent Skill.
 * Matches the grey header styling of the editor toolbar on the left with centered spacing.
 *
 * @author Maruf Bepary
 */
export function SkillDirectorySidebar({
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
}: SkillDirectorySidebarProps) {
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

  return (
    <Card className="flex flex-col gap-0 overflow-hidden rounded-lg border border-border/70 bg-card py-0 shadow-xs">
      {/* Directory header bar matching the gray toolbar of the editor with comfortable top/bottom padding */}
      <div className="flex min-h-[50px] items-center justify-between border-border/70 border-b bg-muted/60 px-4 py-3 dark:bg-muted/30">
        <div className="flex items-center gap-2">
          <Files className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Directory</h3>
          <Badge
            variant="secondary"
            className="px-1.5 py-0 font-normal text-xs"
          >
            {files.length + 1}
          </Badge>
        </div>

        {/* Action buttons with Shadcn UI Tooltips */}
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => openNewFileDialog("")}
                  title="New File"
                  aria-label="New File"
                >
                  <FilePlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">New File</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => openNewFolderDialog("")}
                  title="New Folder"
                  aria-label="New Folder"
                >
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">New Folder</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      <div
        className="flex-1 space-y-0.5 overflow-y-auto p-2"
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
    </Card>
  );
}
