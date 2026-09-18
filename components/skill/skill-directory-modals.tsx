"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cleanPath, getAllFolders } from "@/lib/skills/skill-tree-utils";
import type { SkillBundledFile } from "@/types/skill/skill";

export interface SkillDirectoryModalsProps {
  files: SkillBundledFile[];
  emptyFolders?: string[];
  fileDialogOpen: boolean;
  onCloseFileDialog: () => void;
  targetFileParent: string;
  onCreateFile: (path: string, initialContent?: string) => void;

  folderDialogOpen: boolean;
  onCloseFolderDialog: () => void;
  targetFolderParent: string;
  onCreateFolder: (folderPath: string) => void;

  renameFileDialogOpen: boolean;
  onCloseRenameFileDialog: () => void;
  fileToRename: string;
  onRenameFile: (oldPath: string, newPath: string) => void;

  renameFolderDialogOpen: boolean;
  onCloseRenameFolderDialog: () => void;
  folderToRename: string;
  onRenameFolder: (oldPrefix: string, newPrefix: string) => void;

  deleteFolderDialogOpen: boolean;
  onCloseDeleteFolderDialog: () => void;
  folderToDelete: string;
  onDeleteFolder: (folderPath: string) => void;

  moveFileDialogOpen: boolean;
  onCloseMoveFileDialog: () => void;
  fileToMove: string;
  onMoveFile: (sourcePath: string, targetFolder: string) => void;
}

/**
 * Modals collection for Agent Skill directory management:
 * Create file/folder, rename file/folder, move file, and confirm folder deletion.
 *
 * @author Maruf Bepary
 */
export function SkillDirectoryModals({
  files,
  emptyFolders = [],
  fileDialogOpen,
  onCloseFileDialog,
  targetFileParent,
  onCreateFile,
  folderDialogOpen,
  onCloseFolderDialog,
  targetFolderParent,
  onCreateFolder,
  renameFileDialogOpen,
  onCloseRenameFileDialog,
  fileToRename,
  onRenameFile,
  renameFolderDialogOpen,
  onCloseRenameFolderDialog,
  folderToRename,
  onRenameFolder,
  deleteFolderDialogOpen,
  onCloseDeleteFolderDialog,
  folderToDelete,
  onDeleteFolder,
  moveFileDialogOpen,
  onCloseMoveFileDialog,
  fileToMove,
  onMoveFile,
}: SkillDirectoryModalsProps) {
  const [fileNameInput, setFileNameInput] = useState("");
  const [folderNameInput, setFolderNameInput] = useState("");
  const [newFilePathInput, setNewFilePathInput] = useState(fileToRename);
  const [newFolderPathInput, setNewFolderPathInput] = useState(folderToRename);
  const [selectedMoveFolder, setSelectedMoveFolder] = useState("");

  const availableFolders = useMemo(
    () => getAllFolders(files, emptyFolders),
    [files, emptyFolders],
  );

  const affectedFilesCount = useMemo(() => {
    if (!folderToDelete) return 0;
    const prefix = `${cleanPath(folderToDelete)}/`;
    return files.filter((f) => cleanPath(f.path).startsWith(prefix)).length;
  }, [files, folderToDelete]);

  const handleCreateFile = () => {
    const raw = fileNameInput.trim();
    if (!raw) return toast.error("File name is required");
    const fullPath = targetFileParent
      ? cleanPath(`${targetFileParent}/${raw}`)
      : cleanPath(raw);

    if (fullPath.toLowerCase() === "skill.md") {
      return toast.error("SKILL.md is the main instruction file at root");
    }
    const exists = files.some(
      (f) => cleanPath(f.path).toLowerCase() === fullPath.toLowerCase(),
    );
    if (exists) return toast.error(`File "${fullPath}" already exists`);

    onCreateFile(fullPath, `# ${fullPath}\n\n`);
    setFileNameInput("");
    onCloseFileDialog();
    toast.success(`Created file "${fullPath}"`);
  };

  const handleCreateFolder = () => {
    const raw = folderNameInput.trim();
    if (!raw) return toast.error("Folder name is required");
    const fullFolderPath = targetFolderParent
      ? cleanPath(`${targetFolderParent}/${raw}`)
      : cleanPath(raw);

    onCreateFolder(fullFolderPath);
    setFolderNameInput("");
    onCloseFolderDialog();
    toast.success(`Created folder "${fullFolderPath}"`);
  };

  const handleRenameFile = () => {
    const cleaned = cleanPath(newFilePathInput || fileToRename);
    if (!cleaned) return toast.error("New file path is required");
    if (cleaned.toLowerCase() === "skill.md") {
      return toast.error("Cannot rename to SKILL.md");
    }
    const exists = files.some(
      (f) =>
        cleanPath(f.path).toLowerCase() === cleaned.toLowerCase() &&
        cleanPath(f.path).toLowerCase() !==
          cleanPath(fileToRename).toLowerCase(),
    );
    if (exists) return toast.error(`File "${cleaned}" already exists`);

    onRenameFile(fileToRename, cleaned);
    onCloseRenameFileDialog();
    toast.success("File renamed");
  };

  const handleRenameFolder = () => {
    const cleaned = cleanPath(newFolderPathInput || folderToRename);
    if (!cleaned) return toast.error("New folder name is required");
    onRenameFolder(folderToRename, cleaned);
    onCloseRenameFolderDialog();
    toast.success("Folder renamed");
  };

  const handleDeleteFolder = () => {
    onDeleteFolder(folderToDelete);
    onCloseDeleteFolderDialog();
    toast.success(`Folder "${folderToDelete}" deleted`);
  };

  const handleMoveFile = () => {
    try {
      onMoveFile(fileToMove, selectedMoveFolder);
      onCloseMoveFileDialog();
      toast.success(
        `Moved "${fileToMove}" to ${selectedMoveFolder ? `"${selectedMoveFolder}/"` : "root"}`,
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to move file");
    }
  };

  return (
    <>
      {/* Create File */}
      <Dialog
        open={fileDialogOpen}
        onOpenChange={(o) => !o && onCloseFileDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
            <DialogDescription>
              {targetFileParent
                ? `Creating inside "${targetFileParent}/"`
                : "Create a new file in skill package"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={fileNameInput}
              onChange={(e) => setFileNameInput(e.target.value)}
              placeholder="guide.md or script.py"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseFileDialog}>
              Cancel
            </Button>
            <Button onClick={handleCreateFile}>Create File</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder */}
      <Dialog
        open={folderDialogOpen}
        onOpenChange={(o) => !o && onCloseFolderDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              {targetFolderParent
                ? `Creating subfolder inside "${targetFolderParent}/"`
                : "Create a new folder in skill package"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={folderNameInput}
              onChange={(e) => setFolderNameInput(e.target.value)}
              placeholder="references, scripts, or assets"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseFolderDialog}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename File */}
      <Dialog
        open={renameFileDialogOpen}
        onOpenChange={(o) => !o && onCloseRenameFileDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Update path for {fileToRename}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              defaultValue={fileToRename}
              onChange={(e) => setNewFilePathInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRenameFile()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseRenameFileDialog}>
              Cancel
            </Button>
            <Button onClick={handleRenameFile}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder */}
      <Dialog
        open={renameFolderDialogOpen}
        onOpenChange={(o) => !o && onCloseRenameFolderDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Updates path prefix for all files in this folder.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              defaultValue={folderToRename}
              onChange={(e) => setNewFolderPathInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseRenameFolderDialog}>
              Cancel
            </Button>
            <Button onClick={handleRenameFolder}>Rename Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move File */}
      <Dialog
        open={moveFileDialogOpen}
        onOpenChange={(o) => !o && onCloseMoveFileDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move File</DialogTitle>
            <DialogDescription>
              Select destination folder for &quot;{fileToMove}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="font-medium text-sm">Quick Destination</label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant={selectedMoveFolder === "" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMoveFolder("")}
                  className="h-8 font-medium text-xs"
                >
                  Root (/)
                </Button>
                {availableFolders.map((folder) => (
                  <Button
                    key={folder}
                    type="button"
                    variant={
                      selectedMoveFolder === folder ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setSelectedMoveFolder(folder)}
                    className="h-8 font-medium text-xs"
                  >
                    {folder}/
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-sm">
                Or Destination Folder Path
              </label>
              <Input
                value={selectedMoveFolder}
                onChange={(e) => setSelectedMoveFolder(e.target.value)}
                placeholder="e.g. references, scripts/utils"
                className="h-9 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleMoveFile()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseMoveFileDialog}>
              Cancel
            </Button>
            <Button onClick={handleMoveFile}>Move File</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder */}
      <Dialog
        open={deleteFolderDialogOpen}
        onOpenChange={(o) => !o && onCloseDeleteFolderDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Delete Folder &quot;{folderToDelete}&quot;?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this folder and its{" "}
              {affectedFilesCount} contained file(s)? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseDeleteFolderDialog}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteFolder}>
              Delete Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
