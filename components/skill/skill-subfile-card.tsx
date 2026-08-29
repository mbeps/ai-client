"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { FileCode, Pencil, Eye, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";
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
  /** Initial mode: "view" (default) or "edit" */
  initialMode?: "view" | "edit";
  /** Callback fired when a new draft subfile is cancelled */
  onCancelNew?: () => void;
}

/**
 * Interactive subfile card for Agent Skills.
 * Renders subfile instructions and toggles smoothly into an inline editing view
 * using Shadcn UI Tabs with screen-height-based responsive sizing.
 *
 * @author Maruf Bepary
 */
export function SkillSubfileCard({
  file,
  onSave,
  onDelete,
  existingPaths = [],
  initialMode = "view",
  onCancelNew,
}: SkillSubfileCardProps) {
  const [mode, setMode] = useState<"view" | "edit">(initialMode);
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
    setMode("view");
  };

  const handleCancel = () => {
    if (onCancelNew) {
      onCancelNew();
      return;
    }
    setFilePath(file.path);
    setFileContent(file.content);
    setMode("view");
  };

  const handleToggleMode = () => {
    if (mode === "view") {
      setMode("edit");
    } else {
      handleCancel();
    }
  };

  return (
    <Card className="p-4 space-y-3 transition-colors">
      <Tabs
        value={mode}
        onValueChange={(val) => setMode(val as "view" | "edit")}
        className="w-full space-y-3"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3">
          {mode === "view" ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileCode className="h-4 w-4 text-primary shrink-0" />
              <span className="font-mono text-sm font-semibold truncate">
                {file.path || "untitled.md"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileCode className="h-4 w-4 text-primary shrink-0" />
              <Input
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="references/guide.md"
                className="font-mono text-sm h-8 max-w-sm"
                autoFocus={!file.path}
              />
            </div>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleToggleMode}
              title={mode === "view" ? "Edit subfile" : "View preview"}
              aria-label={mode === "view" ? "Edit subfile" : "View preview"}
            >
              {mode === "view" ? (
                <Pencil className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              title="Delete subfile"
              aria-label="Delete subfile"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* View Mode Content */}
        <TabsContent value="view" className="mt-0 focus-visible:outline-hidden">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm overflow-y-auto max-h-[50vh] min-h-[100px]">
            {file.content.trim() ? (
              <MarkdownRenderer content={file.content} />
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Empty subfile. Click the edit icon above to add content.
              </p>
            )}
          </div>
        </TabsContent>

        {/* Edit Mode Content */}
        <TabsContent
          value="edit"
          className="mt-0 space-y-3 focus-visible:outline-hidden"
        >
          <MarkdownTabEditor
            value={fileContent}
            onChange={setFileContent}
            placeholder="# Subfile Content\n\nAdd reference documentation, code snippets, or templates..."
            minHeight="min-h-[280px] md:min-h-[35vh]"
            maxHeight="max-h-[55vh] md:max-h-[60vh]"
          />
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
