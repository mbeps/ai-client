"use client";

import { Files, Loader2, Plus, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SkillSubfileCard } from "@/components/skill/skill-subfile-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SkillBundledFile } from "@/types/skill/skill";

export interface SkillSubfilesManagerProps {
  /** Array of bundled subfiles for the skill */
  files: SkillBundledFile[];
  /** Callback fired when files are added, updated, or removed */
  onSaveFiles: (updatedFiles: SkillBundledFile[]) => Promise<void> | void;
  /** Whether the skill changes are actively saving */
  isSaving?: boolean;
}

/**
 * Subfiles manager section for an Agent Skill.
 * Encapsulates listing, inline creation, editing, deleting, and batch saving of skill subfiles.
 *
 * @author Maruf Bepary
 */
export function SkillSubfilesManager({
  files,
  onSaveFiles,
  isSaving = false,
}: SkillSubfilesManagerProps) {
  const [isAddingSubfile, setIsAddingSubfile] = useState(false);

  const handleAddSubfile = async (newFile: SkillBundledFile) => {
    const updatedFiles = [...files, newFile];
    setIsAddingSubfile(false);
    await onSaveFiles(updatedFiles);
    toast.success(`Subfile "${newFile.path}" added`);
  };

  const handleUpdateSubfile = async (
    index: number,
    updatedFile: SkillBundledFile,
  ) => {
    const updatedFiles = files.map((f, i) => (i === index ? updatedFile : f));
    await onSaveFiles(updatedFiles);
    toast.success("Subfile updated");
  };

  const handleDeleteSubfile = async (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    await onSaveFiles(updatedFiles);
    toast.success("Subfile removed");
  };

  const existingPaths = files.map((f) => f.path);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-lg">Bundled Subfiles</h3>
          <p className="text-muted-foreground text-sm">
            Supporting scripts, templates, or documentation bundled inside this
            skill package.
          </p>
        </div>
        <Button
          onClick={() => setIsAddingSubfile(true)}
          disabled={isAddingSubfile || isSaving}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Subfile
        </Button>
      </div>

      <div className="space-y-4">
        {isAddingSubfile && (
          <SkillSubfileCard
            file={{ path: "", content: "" }}
            defaultOpen={true}
            onSave={handleAddSubfile}
            onDelete={() => setIsAddingSubfile(false)}
            onCancelNew={() => setIsAddingSubfile(false)}
            existingPaths={existingPaths}
          />
        )}

        {files.map((file, idx) => (
          <SkillSubfileCard
            key={`${file.path}-${idx}`}
            file={file}
            onSave={(updated) => handleUpdateSubfile(idx, updated)}
            onDelete={() => handleDeleteSubfile(idx)}
            existingPaths={existingPaths}
          />
        ))}

        {files.length === 0 && !isAddingSubfile && (
          <Card className="border-dashed p-8 text-center">
            <div className="flex flex-col items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Files className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-sm">No subfiles yet</p>
                <p className="max-w-sm text-muted-foreground text-xs">
                  Add supporting reference markdown, code scripts, schemas, or
                  templates that the model can inspect when using this skill.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingSubfile(true)}
                disabled={isSaving}
                className="mt-2 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add First Subfile
              </Button>
            </div>
          </Card>
        )}
      </div>

      {files.length > 0 && (
        <div>
          <Button onClick={() => onSaveFiles(files)} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
export default SkillSubfilesManager;
