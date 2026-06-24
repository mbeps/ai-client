"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadKbDocument } from "@/lib/actions/knowledgebases/upload-kb-document";
import { ingestKbDocument } from "@/lib/actions/knowledgebases/ingest-kb-document";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import { useUserModels } from "@/hooks/use-user-models";

const ACCEPTED_TYPES = ".pdf,.txt,.md";
const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

type Phase = "idle" | "uploading" | "ingesting" | "error";

const PHASE_LABELS: Record<Phase, string | null> = {
  idle: null,
  uploading: "Uploading...",
  ingesting: "Starting ingestion...",
  error: null,
};

interface UploadDocumentDialogProps {
  kbId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (doc: KbDocumentRow) => void;
}

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

  const { models } = useUserModels("embedding");
  const hasNoModels = models.length === 0;

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
    if (selected.size > MAX_SIZE_BYTES) {
      setError(`File exceeds the ${MAX_SIZE_MB} MB limit.`);
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

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kbId", kbId);

      const doc = await uploadKbDocument(formData);

      setPhase("ingesting");

      const result = await ingestKbDocument(doc.id);
      if (!result.success) {
        // Build a custom error object to trigger existing toast and error display logic
        const error: any = new Error(result.error ?? "Ingestion failed");
        if (result.code) error.code = result.code;
        throw error;
      }

      toast.success(`"${file.name}" uploaded and queued for processing`);
      onSuccess(doc);
      onOpenChange(false);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setPhase("error");
      setError(msg);
      toast.error(msg);
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
              accept={ACCEPTED_TYPES}
              onChange={handleFileChange}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Supported: PDF, plain text (.txt), Markdown (.md) &middot; Max{" "}
              {MAX_SIZE_MB} MB
            </p>
          </div>

          {file && !error && (
            <p className="text-sm text-muted-foreground truncate">
              Selected:{" "}
              <span className="font-medium text-foreground">{file.name}</span>
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {statusLabel && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {statusLabel}
            </div>
          )}

          {hasNoModels && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
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
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!file || isLoading || !!error || hasNoModels}
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
