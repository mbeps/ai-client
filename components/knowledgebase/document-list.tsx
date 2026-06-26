"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Trash2,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { deleteDocument } from "@/lib/actions/knowledgebases/delete-document";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    variant: "secondary" as const,
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    variant: "secondary" as const,
  },
  ready: {
    label: "Ready",
    icon: CheckCircle2,
    variant: "default" as const,
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    variant: "destructive" as const,
  },
};

interface DocumentListProps {
  documents: KbDocumentRow[];
  onDeleted: (documentId: string) => void;
}

export function DocumentList({ documents, onDeleted }: DocumentListProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(documentId: string) {
    startTransition(async () => {
      try {
        await deleteDocument({ documentId });
        toast.success("Document deleted");
        onDeleted(documentId);
      } catch {
        toast.error("Failed to delete document");
      }
    });
  }

  if (documents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No documents uploaded yet.
      </p>
    );
  }

  return (
    <ul className="divide-y border rounded-md">
      {documents.map((doc) => {
        const cfg =
          STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG] ??
          STATUS_CONFIG.pending;
        const Icon = cfg.icon;
        return (
          <li key={doc.id} className="group flex items-center gap-2 px-3 py-2">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate leading-tight">
                {doc.name}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">
                {doc.status === "failed" && doc.statusMessage ? (
                  <span className="text-destructive font-medium">
                    {doc.statusMessage}
                  </span>
                ) : (
                  <>
                    {doc.chunkCount} chunks &middot;{" "}
                    {(doc.size / 1024).toFixed(1)} KB
                  </>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                variant={cfg.variant}
                className="flex items-center gap-1 shrink-0 text-[10px] px-1.5 py-0 h-5 font-normal"
              >
                <Icon
                  className={`h-2.5 w-2.5${doc.status === "processing" ? " animate-spin" : ""}`}
                />
                {cfg.label}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                disabled={isPending}
                onClick={() => handleDelete(doc.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
