"use client";

import { FilePlus, Files, FolderPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { SkillDirectoryModals } from "@/components/skill/skill-directory-modals";
import { SkillDirectoryTreeItem } from "@/components/skill/skill-directory-tree-item";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { buildSkillTree } from "@/lib/skills/build-skill-tree";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Props for the SkillDirectoryPicker component.
 *
 * @author Maruf Bepary
 */
export interface SkillDirectoryPickerProps {
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
 * Directory section component for an Agent Skill rendered inside an Accordion.
 * Collapsed by default. Arrow is placed all the way to the right across the full width.
 * Actions (New File, New Folder) are located inside the accordion content above the tree view.
 *
 * @author Maruf Bepary
 */
export function SkillDirectoryPicker({
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
}: SkillDirectoryPickerProps) {
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
    <div className="w-full">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem
          value="directory"
          className="border-border/70 bg-card overflow-hidden rounded-lg border shadow-xs"
        >
          {/* Header Bar: Full-width trigger with Directory on left and Arrow all the way to right */}
          <div className="border-border/70 bg-muted/60 dark:bg-muted/30 w-full">
            <AccordionTrigger className="w-full items-center justify-between px-4 py-2.5 hover:no-underline [&>svg]:translate-y-0">
              <div className="flex items-center gap-2">
                <Files className="text-primary h-4 w-4" />
                <span className="text-sm font-semibold">Directory</span>
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 text-xs font-normal"
                >
                  {files.length + 1}
                </Badge>
              </div>
            </AccordionTrigger>
          </div>

          {/* Accordion Content: Action bar at top, followed by Tree View */}
          <AccordionContent className="p-0">
            {/* Action Bar inside Accordion: New File & New Folder */}
            <div className="border-border/50 bg-muted/40 flex items-center justify-between border-t px-3 py-1.5">
              <span className="text-muted-foreground text-xs font-medium">
                Actions
              </span>
              <TooltipProvider delayDuration={300}>
                <div className="flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs font-medium"
                        onClick={() => openNewFileDialog("")}
                        title="New File"
                        aria-label="New File"
                      >
                        <FilePlus className="h-3.5 w-3.5" />
                        <span>New File</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">New File</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs font-medium"
                        onClick={() => openNewFolderDialog("")}
                        title="New Folder"
                        aria-label="New Folder"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        <span>New Folder</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">New Folder</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            {/* Tree View */}
            <div
              className="border-border/50 bg-muted/20 space-y-0.5 border-t p-2"
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Directory Dialog Modals */}
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
    </div>
  );
}
