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
import { getAllFolders } from "@/lib/skills/get-all-folders";
import { cleanPath } from "@/lib/skills/skill-tree-utils";
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

function validateNewSkillFilePath(
  raw: string,
  targetParent: string,
  files: SkillBundledFile[],
): { error?: string; fullPath?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "File name is required" };
  }
  const fullPath = targetParent
    ? cleanPath(`${targetParent}/${trimmed}`)
    : cleanPath(trimmed);

  if (fullPath.toLowerCase() === "skill.md") {
    return { error: "SKILL.md is the main instruction file at root" };
  }
  const exists = files.some(
    (f) => cleanPath(f.path).toLowerCase() === fullPath.toLowerCase(),
  );
  if (exists) {
    return { error: `File "${fullPath}" already exists` };
  }
  return { fullPath };
}

function validateRenamedSkillFilePath(
  newInput: string,
  fileToRename: string,
  files: SkillBundledFile[],
): { error?: string; cleaned?: string } {
  const cleaned = cleanPath(newInput || fileToRename);
  if (!cleaned) {
    return { error: "New file path is required" };
  }
  if (cleaned.toLowerCase() === "skill.md") {
    return { error: "Cannot rename to SKILL.md" };
  }
  const targetLower = cleanPath(fileToRename).toLowerCase();
  const exists = files.some((f) => {
    const p = cleanPath(f.path).toLowerCase();
    return p === cleaned.toLowerCase() && p !== targetLower;
  });
  if (exists) {
    return { error: `File "${cleaned}" already exists` };
  }
  return { cleaned };
}

type MoveOrDeleteFolderModalsProps = {
  moveFileDialogOpen: boolean;
  onCloseMoveFileDialog: () => void;
  fileToMove: string;
  onMoveFile: (sourcePath: string, targetFolder: string) => void;
  availableFolders: string[];
  deleteFolderDialogOpen: boolean;
  onCloseDeleteFolderDialog: () => void;
  folderToDelete: string;
  onDeleteFolder: (folderPath: string) => void;
  affectedFilesCount: number;
};

function MoveOrDeleteFolderModals(props: MoveOrDeleteFolderModalsProps) {
  const [selectedMoveFolder, setSelectedMoveFolder] = useState("");

  const handleMoveFile = () => {
    try {
      props.onMoveFile(props.fileToMove, selectedMoveFolder);
      props.onCloseMoveFileDialog();
      const destLabel = selectedMoveFolder
        ? `"${selectedMoveFolder}/"`
        : "root";
      toast.success(`Moved "${props.fileToMove}" to ${destLabel}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to move file");
    }
  };

  const handleDeleteFolder = () => {
    props.onDeleteFolder(props.folderToDelete);
    props.onCloseDeleteFolderDialog();
    toast.success(`Folder "${props.folderToDelete}" deleted`);
  };

  return (
    <>
      {/* Move File */}
      <Dialog
        open={props.moveFileDialogOpen}
        onOpenChange={(o) => !o && props.onCloseMoveFileDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move File</DialogTitle>
            <DialogDescription>
              Select destination folder for &quot;{props.fileToMove}&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Quick Destination</label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant={selectedMoveFolder === "" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedMoveFolder("")}
                  className="h-8 text-xs font-medium"
                >
                  Root (/)
                </Button>
                {props.availableFolders.map((folder) => (
                  <Button
                    key={folder}
                    type="button"
                    variant={
                      selectedMoveFolder === folder ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setSelectedMoveFolder(folder)}
                    className="h-8 text-xs font-medium"
                  >
                    {folder}/
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">
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
            <Button variant="outline" onClick={props.onCloseMoveFileDialog}>
              Cancel
            </Button>
            <Button onClick={handleMoveFile}>Move File</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder */}
      <Dialog
        open={props.deleteFolderDialogOpen}
        onOpenChange={(o) => !o && props.onCloseDeleteFolderDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Delete Folder &quot;{props.folderToDelete}&quot;?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this folder and its{" "}
              {props.affectedFilesCount} contained file(s)? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={props.onCloseDeleteFolderDialog}>
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

/**
 * Modals collection for Agent Skill directory management:
 * Create file/folder, rename file/folder, move file, and confirm folder deletion.
 *
 * @author Maruf Bepary
 */
export function SkillDirectoryModals(props: SkillDirectoryModalsProps) {
  const [fileNameInput, setFileNameInput] = useState("");
  const [folderNameInput, setFolderNameInput] = useState("");
  const [newFilePathInput, setNewFilePathInput] = useState(props.fileToRename);
  const [newFolderPathInput, setNewFolderPathInput] = useState(
    props.folderToRename,
  );

  const availableFolders = useMemo(
    () => getAllFolders(props.files, props.emptyFolders),
    [props.files, props.emptyFolders],
  );

  const affectedFilesCount = useMemo(() => {
    if (!props.folderToDelete) return 0;
    const prefix = `${cleanPath(props.folderToDelete)}/`;
    return props.files.filter((f) => cleanPath(f.path).startsWith(prefix))
      .length;
  }, [props.files, props.folderToDelete]);

  const handleCreateFile = () => {
    const res = validateNewSkillFilePath(
      fileNameInput,
      props.targetFileParent,
      props.files,
    );
    if (res.error) return toast.error(res.error);
    if (!res.fullPath) return;

    props.onCreateFile(res.fullPath, `# ${res.fullPath}\n\n`);
    setFileNameInput("");
    props.onCloseFileDialog();
    toast.success(`Created file "${res.fullPath}"`);
  };

  const handleCreateFolder = () => {
    const raw = folderNameInput.trim();
    if (!raw) return toast.error("Folder name is required");
    const fullFolderPath = props.targetFolderParent
      ? cleanPath(`${props.targetFolderParent}/${raw}`)
      : cleanPath(raw);

    props.onCreateFolder(fullFolderPath);
    setFolderNameInput("");
    props.onCloseFolderDialog();
    toast.success(`Created folder "${fullFolderPath}"`);
  };

  const handleRenameFile = () => {
    const res = validateRenamedSkillFilePath(
      newFilePathInput,
      props.fileToRename,
      props.files,
    );
    if (res.error) return toast.error(res.error);
    if (!res.cleaned) return;

    props.onRenameFile(props.fileToRename, res.cleaned);
    props.onCloseRenameFileDialog();
    toast.success("File renamed");
  };

  const handleRenameFolder = () => {
    const cleaned = cleanPath(newFolderPathInput || props.folderToRename);
    if (!cleaned) return toast.error("New folder name is required");
    props.onRenameFolder(props.folderToRename, cleaned);
    props.onCloseRenameFolderDialog();
    toast.success("Folder renamed");
  };

  return (
    <>
      {/* Create File */}
      <Dialog
        open={props.fileDialogOpen}
        onOpenChange={(o) => !o && props.onCloseFileDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New File</DialogTitle>
            <DialogDescription>
              {props.targetFileParent
                ? `Creating inside "${props.targetFileParent}/"`
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
            <Button variant="outline" onClick={props.onCloseFileDialog}>
              Cancel
            </Button>
            <Button onClick={handleCreateFile}>Create File</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder */}
      <Dialog
        open={props.folderDialogOpen}
        onOpenChange={(o) => !o && props.onCloseFolderDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>
              {props.targetFolderParent
                ? `Creating subfolder inside "${props.targetFolderParent}/"`
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
            <Button variant="outline" onClick={props.onCloseFolderDialog}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename File */}
      <Dialog
        open={props.renameFileDialogOpen}
        onOpenChange={(o) => !o && props.onCloseRenameFileDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Update path for {props.fileToRename}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              defaultValue={props.fileToRename}
              onChange={(e) => setNewFilePathInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRenameFile()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={props.onCloseRenameFileDialog}>
              Cancel
            </Button>
            <Button onClick={handleRenameFile}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Folder */}
      <Dialog
        open={props.renameFolderDialogOpen}
        onOpenChange={(o) => !o && props.onCloseRenameFolderDialog()}
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
              defaultValue={props.folderToRename}
              onChange={(e) => setNewFolderPathInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={props.onCloseRenameFolderDialog}>
              Cancel
            </Button>
            <Button onClick={handleRenameFolder}>Rename Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveOrDeleteFolderModals
        moveFileDialogOpen={props.moveFileDialogOpen}
        onCloseMoveFileDialog={props.onCloseMoveFileDialog}
        fileToMove={props.fileToMove}
        onMoveFile={props.onMoveFile}
        availableFolders={availableFolders}
        deleteFolderDialogOpen={props.deleteFolderDialogOpen}
        onCloseDeleteFolderDialog={props.onCloseDeleteFolderDialog}
        folderToDelete={props.folderToDelete}
        onDeleteFolder={props.onDeleteFolder}
        affectedFilesCount={affectedFilesCount}
      />
    </>
  );
}
