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
import type { KbDocumentRow } from "@/types/kb-document-row";
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
          <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.name}</p>
              <p className="text-xs text-muted-foreground">
                {doc.chunkCount} chunks &middot; {(doc.size / 1024).toFixed(1)}{" "}
                KB
              </p>
            </div>
            <Badge
              variant={cfg.variant}
              className="flex items-center gap-1 shrink-0"
            >
              <Icon
                className={`h-3 w-3${doc.status === "processing" ? " animate-spin" : ""}`}
              />
              {cfg.label}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              disabled={isPending}
              onClick={() => handleDelete(doc.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
