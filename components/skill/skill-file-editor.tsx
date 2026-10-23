"use client";

import { FolderInput, Pencil, Trash2 } from "lucide-react";
import { MarkdownTabEditor } from "@/components/shared/markdown-tab-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface SkillFileEditorProps {
  filePath: string;
  content: string;
  onChangeContent: (value: string) => void;
  onRename?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
}

/**
 * Editor panel for displaying and updating the currently selected file or root SKILL.md.
 * Renders the active file title, badge, subfile action buttons, and markdown tab editor.
 *
 * @author Maruf Bepary
 */
export function SkillFileEditor({
  filePath,
  content,
  onChangeContent,
  onRename,
  onMove,
  onDelete,
}: SkillFileEditorProps) {
  const isRootSkillMd = filePath === "SKILL.md";

  return (
    <div className="flex h-full min-h-[calc(100vh-14rem)] flex-col space-y-2">
      {/* Header bar: File name, badge, and optional subfile actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-foreground truncate text-sm font-semibold">
            {filePath}
          </span>

          {isRootSkillMd ? (
            <Badge variant="secondary" className="text-xs font-normal">
              Primary Instructions
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs font-normal">
              Subfile
            </Badge>
          )}
        </div>

        {!isRootSkillMd && (
          <div className="flex items-center gap-1.5">
            {onRename && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRename}
                className="h-7 gap-1 text-xs font-medium"
              >
                <Pencil className="h-3 w-3" />
                Rename
              </Button>
            )}

            {onMove && (
              <Button
                variant="outline"
                size="sm"
                onClick={onMove}
                className="h-7 gap-1 text-xs font-medium"
              >
                <FolderInput className="h-3 w-3" />
                Move
              </Button>
            )}

            {onDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive h-7 gap-1 text-xs font-medium"
              >
                <Trash2 className="h-3 w-3" />
                Delete File
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Editor component */}
      <div className="flex min-h-0 flex-1 flex-col">
        <MarkdownTabEditor
          value={content}
          onChange={onChangeContent}
          className="flex h-full flex-1 flex-col"
          placeholder={
            isRootSkillMd
              ? "# Skill Instructions\n\nDefine guidance, steps, constraints, and examples for this skill..."
              : "# Subfile Content\n\nAdd reference documentation, script code, or templates..."
          }
          minHeight="min-h-[calc(100vh-17rem)]"
          maxHeight="max-h-[calc(100vh-17rem)]"
        />
      </div>
    </div>
  );
}
