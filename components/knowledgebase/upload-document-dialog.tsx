"use client";

import { AlertCircle, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KB_CONFIG } from "@/config/knowledgebase";
import { useUserModels } from "@/hooks/use-user-models";

/**
 * Represents upload document dialog props.
 *
 * @author Maruf Bepary
 */
interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (file: File) => void;
}

/**
 * Modal dialog for selecting and validating a knowledgebase document before
 * handing it off to the page-level upload progress tracker.
 *
 * @param props.open - Whether the dialog is visible.
 * @param props.onOpenChange - Callback to control dialog visibility.
 * @param props.onUpload - Callback invoked with the validated File to upload.
 * @author Maruf Bepary
 */
export function UploadDocumentDialog({
  open,
  onOpenChange,
  onUpload,
}: UploadDocumentDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { models, isLoading: isModelsLoading } = useUserModels("embedding");
  const hasNoModels = !isModelsLoading && models.length === 0;

  const reset = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) reset();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    if (!selected) return;

    const allowedExts = KB_CONFIG.ACCEPTED_EXTENSIONS.split(",").map((s) =>
      s.trim().toLowerCase(),
    );
    const dotIndex = selected.name.lastIndexOf(".");
    const ext =
      dotIndex !== -1 ? selected.name.slice(dotIndex).toLowerCase() : "";

    if (!allowedExts.includes(ext)) {
      setError(
        "Spreadsheets and Office files are not supported. Use PDF, plain text or Markdown.",
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFile(null);
      return;
    }

    if (selected.size > KB_CONFIG.MAX_FILE_SIZE_BYTES) {
      setError(`File exceeds the ${KB_CONFIG.MAX_FILE_SIZE_MB} MB limit.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFile(null);
      return;
    }

    setError(null);
    setFile(selected);
  };

  const handleSubmit = () => {
    if (!file) return;
    const selected = file;
    onOpenChange(false);
    reset();
    onUpload(selected);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              ref={fileInputRef}
              type="file"
              accept={KB_CONFIG.ACCEPTED_EXTENSIONS}
              onChange={handleFileChange}
            />
            <p className="text-muted-foreground text-xs">
              Supported: PDF, plain text (.txt), Markdown (.md) &middot; Max{" "}
              {KB_CONFIG.MAX_FILE_SIZE_MB} MB
            </p>
          </div>

          {file && !error && (
            <p className="text-muted-foreground truncate text-sm">
              Selected:{" "}
              <span className="text-foreground font-medium">{file.name}</span>
            </p>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          {hasNoModels && (
            <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-2 dark:border-red-900/30 dark:bg-red-950/20">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <p className="text-[11px] font-medium text-red-800 dark:text-red-200">
                No embedding models configured. Please set up a provider first.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || !!error || isModelsLoading || hasNoModels}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
