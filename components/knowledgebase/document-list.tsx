"use client";

import {
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Info,
  Loader2,
  Trash2,
  XCircle,
} from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteDocument } from "@/actions/knowledgebases/delete-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResponsiveDetails } from "@/components/ui/responsive-details";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { KB_INGEST_STEPS } from "@/config/knowledgebase";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type {
  KbIngestStepStatus,
  KbIngestStepsState,
} from "@/types/knowledgebase/kb-ingest-steps";

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
 * Stat cell rendered inside the document details grid.
 *
 * @author Maruf Bepary
 */
function DocumentStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value}</dd>
    </div>
  );
}

/**
 * Section heading rendered inside the document details panel.
 *
 * @author Maruf Bepary
 */
function DocumentSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
      {children}
    </h4>
  );
}

/**
 * Details panel content for a single document: classification, size metrics,
 * graph relation count, summary, and extracted key entities.
 *
 * @author Maruf Bepary
 */
function DocumentDetailsContent({ doc }: { doc: KbDocumentRow }) {
  const relationCount = doc.relationCount ?? 0;
  const entities = Array.isArray(doc.keyEntities) ? doc.keyEntities : [];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <DocumentStat
          label="Type"
          value={doc.documentType.replace(/_/g, " ")}
        />
        <DocumentStat
          label="Size"
          value={`${(doc.size / 1024).toFixed(1)} KB`}
        />
        <DocumentStat label="Chunks" value={doc.chunkCount} />
        <DocumentStat label="Tokens" value={doc.tokenCount.toLocaleString()} />
        {relationCount > 0 && (
          <DocumentStat
            label="Links"
            value={relationCount === 1 ? "1 link" : `${relationCount} links`}
          />
        )}
      </dl>
      {doc.summary && (
        <section>
          <DocumentSectionHeading>Summary</DocumentSectionHeading>
          <p className="mt-1.5 text-sm leading-relaxed">{doc.summary}</p>
        </section>
      )}
      {entities.length > 0 && (
        <section>
          <DocumentSectionHeading>Entities</DocumentSectionHeading>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {entities.map((entity) => (
              <Badge key={entity} variant="secondary">
                {entity}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Renders a scrollable list of uploaded documents in a knowledgebase.
 * Shows document name, processing status, and chunk/size line (or failure message).
 * A details button opens a responsive dialog/drawer with full document metadata.
 * Includes delete button with confirmation for each document.
 *
 * @param props - Component properties
 * @param props.documents - Array of uploaded documents to display
 * @param props.onDeleted - Callback invoked after successful document deletion
 * @returns List of document items or empty state message
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

        return (
          <li key={doc.id} className="group flex items-start gap-2 px-3 py-2">
            <FileText className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] leading-tight font-medium">
                {doc.name}
              </p>
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
              {doc.ingestSteps &&
                doc.status !== "ready" &&
                doc.status !== "failed" && (
                  <DocumentProgressSteps steps={doc.ingestSteps} />
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
              <ResponsiveDetails
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    aria-label={`Details for ${doc.name}`}
                  >
                    <Info className="h-3 w-3" />
                  </Button>
                }
                title={doc.name}
                description="Document details"
                tooltip={`Details`}
              >
                <DocumentDetailsContent doc={doc} />
              </ResponsiveDetails>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    aria-label={`Delete ${doc.name}`}
                    disabled={isPending}
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{`Delete`}</TooltipContent>
              </Tooltip>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Renders checkbox-sized step indicators for a document's ingestion progress.
 * Only shown while a document is in-flight (not ready or failed).
 *
 * @param props - Component properties
 * @param props.steps - Current ingestion step states
 */
function DocumentProgressSteps({ steps }: { steps: KbIngestStepsState }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
      {KB_INGEST_STEPS.map((step) => {
        const entry = steps[step.id];
        const status: KbIngestStepStatus = entry?.status ?? "pending";
        if (status === "pending") return null;

        return (
          <li key={step.id} className="flex items-center gap-1">
            {status === "completed" && (
              <Check className="h-3 w-3 shrink-0 text-emerald-600" />
            )}
            {status === "loading" && (
              <Loader2 className="text-primary h-3 w-3 shrink-0 animate-spin" />
            )}
            {status === "failed" && (
              <XCircle className="text-destructive h-3 w-3 shrink-0" />
            )}
            <span
              className={`text-[10px] leading-tight ${
                status === "loading"
                  ? "text-foreground font-medium"
                  : status === "failed"
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
