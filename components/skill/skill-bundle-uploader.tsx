"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSwap } from "@/components/ui/loading-swap";
import { FileArchive, FileText, CheckCircle2, Upload, X } from "lucide-react";
import { toast } from "sonner";
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
        <h3 className="text-lg font-semibold">Import Skill Bundle</h3>
        <p className="text-sm text-muted-foreground">
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
          "border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-colors",
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
              <p className="font-medium text-base text-foreground flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                {selectedFile.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
              }}
            >
              Choose another file
            </Button>
          </>
        ) : (
          <>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Upload className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">
                Drop your skill file here, or{" "}
                <span className="text-primary underline underline-offset-2">
                  browse
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
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
