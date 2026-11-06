"use client";

import { AlertCircle, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ingestKbDocument } from "@/actions/knowledgebases/ingest-kb-document";
import { uploadKbDocument } from "@/actions/knowledgebases/upload-kb-document";
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
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";

/**
 * Represents phase.
 *
 * @author Maruf Bepary
 */
type Phase = "idle" | "uploading" | "ingesting" | "error";

const PHASE_LABELS: Record<Phase, string | null> = {
  idle: null,
  uploading: "Uploading...",
  ingesting: "Starting ingestion...",
  error: null,
};

/**
 * Represents upload document dialog props.
 *
 * @author Maruf Bepary
 */
interface UploadDocumentDialogProps {
  kbId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (doc: KbDocumentRow) => void;
}

/**
 * Modal dialog for uploading documents to a knowledgebase.
 * Handles file selection, validation (size, type), and async upload/ingestion flow.
 * Shows progress states and error messages. Integrates with embedding model selection.
 *
 * @param props.kbId - The knowledgebase ID to upload the document to.
 * @param props.open - Whether the dialog is visible.
 * @param props.onOpenChange - Callback to control dialog visibility.
 * @param props.onSuccess - Callback invoked after successful upload with the document entity.
 * @author Maruf Bepary
 */
export function UploadDocumentDialog({
  kbId,
  open,
  onOpenChange,
  onSuccess,
}: UploadDocumentDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const { models, isLoading: isModelsLoading } = useUserModels("embedding");
  const hasNoModels = !isModelsLoading && models.length === 0;

  const isLoading = phase === "uploading" || phase === "ingesting";

  const reset = () => {
    setFile(null);
    setPhase("idle");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (isLoading) return;
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

  const handleUpload = async () => {
    if (!file) return;

    setPhase("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("kbId", kbId);

    const uploadRes = await uploadKbDocument(formData);
    if (!uploadRes.ok) {
      setPhase("error");
      setError(uploadRes.error.message);
      return;
    }

    const doc = uploadRes.value;
    setPhase("ingesting");

    try {
      const result = await ingestKbDocument(doc.id);
      if (!result.ok) {
        setPhase("error");
        setError(result.error.message || "Ingestion failed");
        return;
      }

      toast.success(`"${file.name}" uploaded and queued for processing`);
      onSuccess(doc);
      onOpenChange(false);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setPhase("error");
      setError(msg);
    }
  };

  const statusLabel = PHASE_LABELS[phase];

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
              disabled={isLoading}
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

          {statusLabel && (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              {statusLabel}
            </div>
          )}

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
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={
              !file || isLoading || !!error || isModelsLoading || hasNoModels
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {statusLabel}
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
