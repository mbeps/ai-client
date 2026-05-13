"use client";

import { NotFoundMessage } from "@/components/not-found-message";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { FileText, Calendar, Upload } from "lucide-react";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { listDocuments } from "@/lib/actions/knowledgebases/list-documents";
import { DocumentList } from "@/components/knowledgebase/document-list";
import { UploadDocumentDialog } from "@/components/knowledgebase/upload-document-dialog";
import type { KbDocumentRow } from "@/types/kb-document-row";

export default function KnowledgebasePage() {
  const params = useParams();
  const kbId = params.id as string;
  const knowledgebases = useAppStore((state) => state.knowledgebases);
  const kb = knowledgebases.find((k) => k.id === kbId);
  const loadKnowledgebases = useAppStore((state) => state.loadKnowledgebases);
  const [documents, setDocuments] = useState<KbDocumentRow[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (knowledgebases.length === 0) {
      loadKnowledgebases().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDocuments = useCallback(() => {
    listDocuments(kbId)
      .then(setDocuments)
      .catch(() => {});
  }, [kbId, setDocuments]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  if (!kb) return <NotFoundMessage entity="Knowledgebase" />;

  const readyCount = documents.filter((d) => d.status === "ready").length;

  return (
    <div className="page-container-detail">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{kb.name}</h1>
        {kb.description && (
          <p className="text-muted-foreground">{kb.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents
            </CardDescription>
            <CardTitle className="text-2xl">{documents.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {documents.length === 0
                ? "No documents uploaded yet."
                : `${readyCount} of ${documents.length} ready`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Created
            </CardDescription>
            <CardTitle className="text-base font-medium">
              {format(kb.createdAt, "PPP")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Last updated {format(kb.updatedAt, "PPP")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Documents</h2>
          <Button size="sm" onClick={() => setShowUpload(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>
        <DocumentList
          documents={documents}
          onDeleted={(id) =>
            setDocuments((prev) => prev.filter((d) => d.id !== id))
          }
        />
      </div>

      <UploadDocumentDialog
        kbId={kbId}
        open={showUpload}
        onOpenChange={setShowUpload}
        onSuccess={(doc) => setDocuments((prev) => [doc, ...prev])}
      />
    </div>
  );
}
