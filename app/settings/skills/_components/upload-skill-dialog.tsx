"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, X, FileArchive, FileText, CheckCircle2 } from "lucide-react";
import { importSkillFile } from "@/lib/actions/skills/import-skill";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface UploadSkillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal dialog for uploading SKILL.md or .zip bundles adhering to the Open Agent Skills format.
 *
 * @author Maruf Bepary
 */
export function UploadSkillDialog({
  open,
  onOpenChange,
}: UploadSkillDialogProps) {
  const loadSkills = useAppStore((state) => state.loadSkills);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const result = await importSkillFile(formData);
      toast.success(
        `Skill "${result.displayName || result.name}" imported successfully!`,
      );
      await loadSkills();
      setSelectedFile(null);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to import skill");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setSelectedFile(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <DialogTitle>Upload Agent Skill</DialogTitle>
          </div>
          <DialogDescription>
            Import a <code>SKILL.md</code> file or a <code>.zip</code> bundle
            containing reference files and instructions.
          </DialogDescription>
        </DialogHeader>

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
            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
            selectedFile && "border-primary bg-primary/5",
          )}
        >
          {selectedFile ? (
            <>
              {selectedFile.name.endsWith(".zip") ? (
                <FileArchive className="h-10 w-10 text-primary" />
              ) : (
                <FileText className="h-10 w-10 text-primary" />
              )}
              <div className="space-y-1">
                <p className="font-medium text-sm text-foreground flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {selectedFile.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 mt-1 text-muted-foreground"
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
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Upload className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Drop your skill file here, or{" "}
                  <span className="text-primary underline underline-offset-2">
                    browse
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports .md files with YAML frontmatter or .zip bundles
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedFile || isUploading}
            onClick={handleSubmit}
          >
            {isUploading ? "Importing..." : "Import Skill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
