"use client";

import {
  CheckCircle2,
  FileArchive,
  FileText,
  RefreshCw,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { cn } from "@/lib/utils";

export interface SkillBundleUploaderProps {
  /** Callback fired when the selected skill file is submitted for import */
  onUpload: (file: File) => Promise<void> | void;
  /** Callback fired when cancellation is clicked */
  onCancel?: () => void;
  /** Whether the upload action is in progress */
  isUploading?: boolean;
}

/**
 * Drag-and-drop uploader component for importing Agent Skill bundles (.zip, .md, .txt).
 *
 * @author Maruf Bepary
 */
export function SkillBundleUploader({
  onUpload,
  onCancel,
  isUploading = false,
}: SkillBundleUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (
      !name.endsWith(".md") &&
      !name.endsWith(".zip") &&
      !name.endsWith(".txt")
    ) {
      toast.error("Please select a .md markdown file or a .zip skill bundle.");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    await onUpload(selectedFile);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="font-semibold text-lg">Import Skill Bundle</h3>
        <p className="text-muted-foreground text-sm">
          Import a <code>SKILL.md</code> file or a <code>.zip</code> bundle
          containing instructions and reference subfiles.
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.zip,.txt"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-12 text-center transition-colors",
          isDragging
            ? "border-primary bg-primary/10"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
          selectedFile && "border-primary bg-primary/5",
        )}
      >
        {selectedFile ? (
          <>
            {selectedFile.name.endsWith(".zip") ? (
              <FileArchive className="h-12 w-12 text-primary" />
            ) : (
              <FileText className="h-12 w-12 text-primary" />
            )}
            <div className="space-y-1">
              <p className="flex items-center justify-center gap-2 font-medium text-base text-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {selectedFile.name}
              </p>
              <p className="text-muted-foreground text-sm">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
              }}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Choose another file
            </Button>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Upload className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-base">
                Drop your skill file here, or{" "}
                <span className="text-primary underline underline-offset-2">
                  browse
                </span>
              </p>
              <p className="text-muted-foreground text-sm">
                Supports .md files with YAML frontmatter or .zip bundles
              </p>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isUploading}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        )}
        <Button
          type="button"
          disabled={!selectedFile || isUploading}
          onClick={handleSubmit}
        >
          <LoadingSwap isLoading={isUploading}>
            <div className="flex items-center">
              <Upload className="mr-2 h-4 w-4" />
              Import Skill
            </div>
          </LoadingSwap>
        </Button>
      </div>
    </div>
  );
}
export default SkillBundleUploader;
