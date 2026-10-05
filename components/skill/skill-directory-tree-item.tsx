"use client";

import {
  ChevronDown,
  ChevronRight,
  File,
  FileCode,
  FilePlus,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SkillTreeNode } from "@/lib/skills/skill-tree-utils";
import { cn } from "@/lib/utils";

export interface SkillDirectoryTreeItemProps {
  node: SkillTreeNode;
  selectedPath: string;
  onSelect: (path: string) => void;
  onNewFile: (folderPath?: string) => void;
  onNewFolder: (parentFolder?: string) => void;
  onRenameFile: (oldPath: string) => void;
  onDeleteFile: (path: string) => void;
  onRenameFolder: (folderPath: string) => void;
  onDeleteFolder: (folderPath: string) => void;
  onRequestMoveFile?: (filePath: string) => void;
  onMoveFile?: (sourcePath: string, targetFolderPath: string) => void;
  level?: number;
}

function getFileIcon(name: string, isRootSkillMd?: boolean) {
  if (isRootSkillMd) {
    return <FileText className="h-4 w-4 shrink-0 text-primary" />;
  }
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".txt")) {
    return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
  if (
    lower.endsWith(".ts") ||
    lower.endsWith(".js") ||
    lower.endsWith(".py") ||
    lower.endsWith(".sh") ||
    lower.endsWith(".json")
  ) {
    return <FileCode className="h-4 w-4 shrink-0 text-amber-500" />;
  }
  return <File className="h-4 w-4 shrink-0 text-muted-foreground" />;
}

/**
 * Interactive tree node representing a file or directory with drag-drop and move support.
 *
 * @author Maruf Bepary
 */
export function SkillDirectoryTreeItem({
  node,
  selectedPath,
  onSelect,
  onNewFile,
  onNewFolder,
  onRenameFile,
  onDeleteFile,
  onRenameFolder,
  onDeleteFolder,
  onRequestMoveFile,
  onMoveFile,
  level = 0,
}: SkillDirectoryTreeItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const indentStyle = { paddingLeft: `${level * 14 + 8}px` };

  if (node.type === "folder") {
    return (
      <div className="select-none">
        <div
          style={indentStyle}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const source = e.dataTransfer.getData("text/plain");
            if (source && onMoveFile) {
              onMoveFile(source, node.path);
            }
          }}
          className={cn(
            "group flex h-8 items-center justify-between rounded-md pr-1 transition-colors",
            isDragOver
              ? "bg-primary/20 ring-1 ring-primary"
              : "hover:bg-muted/60",
          )}
        >
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm"
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {isOpen ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <span className="truncate font-medium text-foreground text-sm">
              {node.name}
            </span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              >
                <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => onNewFile(node.path)}
                className="gap-2 text-xs"
              >
                <FilePlus className="h-4 w-4" />
                New File in Folder
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onNewFolder(node.path)}
                className="gap-2 text-xs"
              >
                <FolderPlus className="h-4 w-4" />
                New Subfolder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onRenameFolder(node.path)}
                className="gap-2 text-xs"
              >
                <Pencil className="h-4 w-4" />
                Rename Folder
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDeleteFolder(node.path)}
                className="gap-2 text-destructive text-xs focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isOpen && node.children && node.children.length > 0 && (
          <div className="mt-0.5 space-y-0.5">
            {node.children.map((child) => (
              <SkillDirectoryTreeItem
                key={child.id}
                node={child}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onNewFile={onNewFile}
                onNewFolder={onNewFolder}
                onRenameFile={onRenameFile}
                onDeleteFile={onDeleteFile}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                onRequestMoveFile={onRequestMoveFile}
                onMoveFile={onMoveFile}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;

  return (
    <div
      style={indentStyle}
      draggable={!node.isRootSkillMd}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", node.path);
      }}
      className={cn(
        "group flex h-8 items-center justify-between rounded-md pr-1 transition-colors",
        isSelected
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
      >
        {getFileIcon(node.name, node.isRootSkillMd)}
        <span className="truncate font-normal text-sm">{node.name}</span>
        {node.isRootSkillMd && (
          <Badge
            variant="secondary"
            className="px-1.5 py-0 font-normal text-xs"
          >
            Main
          </Badge>
        )}
      </button>

      {!node.isRootSkillMd && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem
              onClick={() => onRequestMoveFile?.(node.path)}
              className="gap-2 text-xs"
            >
              <FolderInput className="h-3.5 w-3.5" />
              Move to...
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onRenameFile(node.path)}
              className="gap-2 text-xs"
            >
              <Pencil className="h-3.5 w-3.5" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteFile(node.path)}
              className="gap-2 text-destructive text-xs focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
