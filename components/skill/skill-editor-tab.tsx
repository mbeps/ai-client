"use client";

import { Save } from "lucide-react";
import { SkillDirectoryPicker } from "@/components/skill/skill-directory-picker";
import { SkillFileEditor } from "@/components/skill/skill-file-editor";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import type { SkillBundledFile } from "@/types/skill/skill";

/**
 * Props for the SkillEditorTab component.
 *
 * @author Maruf Bepary
 */
export interface SkillEditorTabProps {
  files: SkillBundledFile[];
  selectedFilePath: string;
  onSelectFile: (path: string) => void;
  activeContent: string;
  onChangeContent: (content: string) => void;
  onCreateFile: (path: string, initialContent?: string) => void;
  onCreateFolder: (folderPath: string) => void;
  onRenameFile: (oldPath: string, newPath: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFolder: (oldPrefix: string, newPrefix: string) => void;
  onDeleteFolder: (folderPath: string) => void;
  onMoveFile: (sourcePath: string, targetFolder: string) => void;
  emptyFolders?: string[];
  fileToMove?: string | null;
  onClearFileToMove?: () => void;
  isSkillMd: boolean;
  onSave: () => Promise<void> | void;
  isSaving: boolean;
}

/**
 * Skill editor tab component displaying the top-mounted directory picker
 * and the full-width markdown file editor for SKILL.md and bundled assets.
 *
 * @author Maruf Bepary
 */
export function SkillEditorTab({
  files,
  selectedFilePath,
  onSelectFile,
  activeContent,
  onChangeContent,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onDeleteFile,
  onRenameFolder,
  onDeleteFolder,
  onMoveFile,
  emptyFolders = [],
  fileToMove,
  onClearFileToMove,
  isSkillMd,
  onSave,
  isSaving,
}: SkillEditorTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Editor</h3>
          <p className="text-muted-foreground text-sm">
            View and edit instructions in SKILL.md and manage bundled reference
            files.
          </p>
        </div>

        <Button onClick={onSave} disabled={isSaving} size="sm">
          <LoadingSwap isLoading={isSaving}>
            <div className="flex items-center">
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </div>
          </LoadingSwap>
        </Button>
      </div>

      {/* Directory picker at the top */}
      <SkillDirectoryPicker
        files={files}
        selectedPath={selectedFilePath}
        onSelectFile={onSelectFile}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onRenameFile={onRenameFile}
        onDeleteFile={onDeleteFile}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        onMoveFile={onMoveFile}
        emptyFolders={emptyFolders}
        externalMoveFile={fileToMove}
        onClearExternalMoveFile={onClearFileToMove}
      />

      {/* Full-width file editor below directory picker */}
      <SkillFileEditor
        key={selectedFilePath}
        filePath={selectedFilePath}
        content={activeContent}
        onChangeContent={onChangeContent}
        onRename={
          !isSkillMd
            ? () => {
                const newPath = prompt(
                  "Enter new file path:",
                  selectedFilePath,
                );
                if (newPath) onRenameFile(selectedFilePath, newPath);
              }
            : undefined
        }
        onMove={
          !isSkillMd && onClearFileToMove
            ? () => {
                // Trigger move via external move file state
              }
            : undefined
        }
        onDelete={!isSkillMd ? () => onDeleteFile(selectedFilePath) : undefined}
      />

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={onSave} disabled={isSaving}>
          <LoadingSwap isLoading={isSaving}>
            <div className="flex items-center">
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </div>
          </LoadingSwap>
        </Button>
      </div>
    </div>
  );
}
