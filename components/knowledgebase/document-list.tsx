"use client";

import {
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteDocument } from "@/actions/knowledgebases/delete-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";

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

/**
 * Represents document list props.
 *
 * @author Maruf Bepary
 */
interface DocumentListProps {
  documents: KbDocumentRow[];
  onDeleted: (documentId: string) => void;
}

/**
 * Renders a scrollable list of uploaded documents in a knowledgebase.
 * Shows document name, processing status, chunk count, file size, classification,
 * summary, key entity tags, and graph relation count.
 * Includes delete button with confirmation for each document.
 *
 * @param props.documents - Array of uploaded documents to display.
 * @param props.onDeleted - Callback invoked after successful document deletion.
 * @returns List of document items or empty state message.
 * @author Maruf Bepary
 */
export function DocumentList({ documents, onDeleted }: DocumentListProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(documentId: string) {
    startTransition(async () => {
      try {
        const res = await deleteDocument({ documentId });
        if (res.ok) {
          toast.success("Document deleted");
          onDeleted(documentId);
        } else {
          toast.error(res.error.message || "Failed to delete document");
        }
      } catch {
        toast.error("Failed to delete document");
      }
    });
  }

  if (documents.length === 0) {
    return (
      <p className="text-muted-foreground py-4 text-sm">
        No documents uploaded yet.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {documents.map((doc) => {
        const cfg =
          STATUS_CONFIG[doc.status as keyof typeof STATUS_CONFIG] ??
          STATUS_CONFIG.pending;
        const Icon = cfg.icon;
        const isReady = doc.status === "ready";
        const hasCustomType =
          isReady && doc.documentType && doc.documentType !== "general";
        const relationCount = doc.relationCount ?? 0;
        const hasRelations = isReady && relationCount > 0;
        const hasSummary = isReady && Boolean(doc.summary);
        const hasEntities =
          isReady &&
          Array.isArray(doc.keyEntities) &&
          doc.keyEntities.length > 0;

        return (
          <li key={doc.id} className="group flex items-start gap-2 px-3 py-2">
            <FileText className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="truncate text-[13px] leading-tight font-medium">
                  {doc.name}
                </p>
                {hasCustomType && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px] font-normal"
                  >
                    {doc.documentType.replace(/_/g, " ")}
                  </Badge>
                )}
                {hasRelations && (
                  <Badge
                    variant="secondary"
                    className="h-4 px-1 text-[9px] font-normal"
                  >
                    {relationCount} {relationCount === 1 ? "link" : "links"}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-0.5 truncate text-[10px] leading-tight">
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
              {hasSummary && (
                <p className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-snug">
                  {doc.summary}
                </p>
              )}
              {hasEntities && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {doc.keyEntities.slice(0, 4).map((entity) => (
                    <Badge
                      key={entity}
                      variant="outline"
                      className="h-4 px-1 text-[9px] font-normal"
                    >
                      {entity}
                    </Badge>
                  ))}
                  {doc.keyEntities.length > 4 && (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1 text-[9px] font-normal"
                    >
                      +{doc.keyEntities.length - 4}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge
                variant={cfg.variant}
                className="flex h-5 shrink-0 items-center gap-1 px-1.5 py-0 text-[10px] font-normal"
              >
                <Icon
                  className={`h-2.5 w-2.5 ${doc.status === "processing" ? "animate-spin" : ""}`}
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
