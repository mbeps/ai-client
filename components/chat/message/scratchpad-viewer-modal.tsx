"use client";

import {
  Check,
  Copy,
  FileCode,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getScratchpadFilesAction } from "@/actions/subagents/get-scratchpad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "../markdown-renderer";

interface ScratchpadFile {
  id: string;
  filePath: string;
  content: string;
  writtenByRole: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScratchpadViewerModalProps {
  chatId?: string;
  messageId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}

/**
 * Slide-out sheet drawer for inspecting shared PostgreSQL scratchpad files
 * created by subagents during a message turn.
 *
 * @author Maruf Bepary
 */
export function ScratchpadViewerModal({
  chatId,
  messageId,
  open,
  onOpenChange,
  trigger,
}: ScratchpadViewerModalProps) {
  const [isOpen, setIsOpen] = useState(open ?? false);
  const [files, setFiles] = useState<ScratchpadFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Sync controlled open prop with local state
  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  const fetchFiles = useCallback(async () => {
    if (!messageId || messageId === "streaming") {
      setFiles([]);
      setSelectedFileId(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = chatId
        ? await getScratchpadFilesAction(chatId, messageId)
        : await getScratchpadFilesAction(messageId);
      setFiles(result);
      if (result.length > 0) {
        setSelectedFileId((prev) =>
          prev && result.some((f) => f.id === prev) ? prev : result[0].id,
        );
      } else {
        setSelectedFileId(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load scratchpad files",
      );
    } finally {
      setLoading(false);
    }
  }, [chatId, messageId]);

  // Load files when sheet opens
  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen, fetchFiles]);

  const activeFile = files.find((f) => f.id === selectedFileId) ?? files[0];

  const handleCopy = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      toast.success(`Copied ${activeFile.filePath} to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy content");
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="right"
        className="flex h-full w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl flex-col gap-0 p-0 overflow-hidden"
      >
        <SheetHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <SheetTitle className="text-base font-semibold">
                Subagent Scratchpad Files
              </SheetTitle>
              {files.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {files.length} {files.length === 1 ? "file" : "files"}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchFiles}
              disabled={loading}
              className="h-8 gap-1.5 text-xs text-muted-foreground"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", loading && "animate-spin")}
              />
              Refresh
            </Button>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Intermediate research notes, outlines, and structured documents
            stored during this response turn.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 min-h-0 divide-x overflow-hidden">
          {/* File sidebar */}
          <div className="w-1/3 min-w-[200px] max-w-[260px] bg-muted/20 flex flex-col">
            <div className="border-b px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Files ({files.length})
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && files.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-xs gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>Loading files...</span>
                </div>
              ) : error ? (
                <div className="p-4 text-xs text-destructive text-center">
                  {error}
                </div>
              ) : files.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No scratchpad files recorded for this turn.
                </div>
              ) : (
                <div className="p-1 space-y-0.5">
                  {files.map((file) => {
                    const isSelected = file.id === activeFile?.id;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setSelectedFileId(file.id)}
                        className={cn(
                          "w-full text-left rounded-md px-2.5 py-2 transition-colors flex flex-col gap-1 text-xs",
                          isSelected
                            ? "bg-accent text-accent-foreground font-medium"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-400" />
                          <span className="truncate font-mono text-[11px]">
                            {file.filePath}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <Badge
                            variant="outline"
                            className="h-3.5 px-1 font-mono text-[9px] uppercase"
                          >
                            {file.writtenByRole}
                          </Badge>
                          <span className="text-muted-foreground">
                            v{file.version}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* File content viewer */}
          <div className="flex flex-1 flex-col min-w-0 bg-background">
            {activeFile ? (
              <>
                <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs font-semibold truncate">
                      {activeFile.filePath}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      v{activeFile.version}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs gap-1.5"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="flex-1 overflow-auto bg-background p-6">
                  <MarkdownRenderer content={activeFile.content} />
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground p-6 text-center">
                Select a file from the list to preview its contents.
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const ScratchpadViewerSheet = ScratchpadViewerModal;
