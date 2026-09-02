"use client";

import { FileCode, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SkillBundledFile } from "@/types/skill/skill";

export interface SkillSubfileCardProps {
  /** Subfile data containing relative path and file content */
  file: SkillBundledFile;
  /** Callback fired when changes are saved */
  onSave: (updatedFile: SkillBundledFile) => void;
  /** Callback fired when subfile is deleted */
  onDelete: () => void;
  /** Existing subfile paths to check against for collisions (excluding this file's path) */
  existingPaths?: string[];
  /** Whether the accordion is expanded by default (defaults to false) */
  defaultOpen?: boolean;
  /** Legacy mode prop preserved for backward compatibility */
  initialMode?: "view" | "edit";
  /** Callback fired when a new draft subfile is cancelled */
  onCancelNew?: () => void;
}

/**
 * Interactive subfile accordion card for Agent Skills.
 * Uses Shadcn UI Accordion with minimised state by default.
 * Full header trigger expands/collapses the editor view containing top action controls
 * (Delete, Reset/Cancel, Save), file path configuration, and the 3-tab markdown editor.
 *
 * @author Maruf Bepary
 */
export function SkillSubfileCard({
  file,
  onSave,
  onDelete,
  existingPaths = [],
  defaultOpen = false,
  onCancelNew,
}: SkillSubfileCardProps) {
  const [filePath, setFilePath] = useState(file.path);
  const [fileContent, setFileContent] = useState(file.content);

  const handleSave = () => {
    const cleanPath = filePath.trim().replace(/^\/+/, "");
    if (!cleanPath) {
      toast.error("File path is required (e.g. references/guide.md)");
      return;
    }

    if (cleanPath.toLowerCase() === "skill.md") {
      toast.error(
        "SKILL.md is the main instruction file. Edit it in the General tab.",
      );
      return;
    }

    const isDuplicate = existingPaths.some(
      (p) =>
        p.toLowerCase() === cleanPath.toLowerCase() &&
        p.toLowerCase() !== file.path.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error(`A subfile with path "${cleanPath}" already exists.`);
      return;
    }

    onSave({ path: cleanPath, content: fileContent });
  };

  const handleCancel = () => {
    if (onCancelNew) {
      onCancelNew();
      return;
    }
    setFilePath(file.path);
    setFileContent(file.content);
  };

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? "subfile" : undefined}
      className="w-full"
    >
      <AccordionItem
        value="subfile"
        className="overflow-hidden rounded-lg border bg-card px-4 text-card-foreground shadow-2xs"
      >
        {/* Full-width Accordion Header Trigger */}
        <AccordionTrigger className="cursor-pointer py-4 text-left hover:no-underline">
          <div className="flex min-w-0 flex-1 items-center gap-2 pr-2">
            <FileCode className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate font-mono font-semibold text-sm">
              {filePath.trim() || file.path || "untitled.md"}
            </span>
          </div>
        </AccordionTrigger>

        {/* Subfile Editing Content */}
        <AccordionContent className="space-y-4 pt-1 pb-4">
          <div className="flex items-center justify-between gap-2 pt-1 pb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Subfile
            </Button>

            <div className="flex items-center gap-2">
              {onCancelNew ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                className="gap-1.5"
              >
                <Save className="h-3.5 w-3.5" />
                Save Subfile
              </Button>
            </div>
          </div>

          {/* File Path Input */}
          <div className="space-y-1.5">
            <label className="font-medium text-muted-foreground text-xs">
              File Path
            </label>
            <Input
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="references/guide.md"
              className="h-9 max-w-md font-mono text-sm"
              autoFocus={!file.path}
            />
          </div>

          {/* Markdown Content Editor */}
          <div className="space-y-1.5">
            <label className="font-medium text-muted-foreground text-xs">
              Content
            </label>
            <MarkdownTabEditor
              value={fileContent}
              onChange={setFileContent}
              placeholder="# Subfile Content\n\nAdd reference documentation, code snippets, or templates..."
              minHeight="min-h-[280px] md:min-h-[35vh]"
              maxHeight="max-h-[55vh] md:max-h-[60vh]"
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
