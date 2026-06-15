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
import {
  FileText,
  Calendar,
  Upload,
  Settings,
  Trash2,
  Library,
  Loader2,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { listDocuments } from "@/lib/actions/knowledgebases/list-documents";
import { getKnowledgebase } from "@/lib/actions/knowledgebases/get-knowledgebase";
import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";
import { listModels } from "@/lib/actions/models/list-models";
import { DocumentList } from "@/components/knowledgebase/document-list";
import { UploadDocumentDialog } from "@/components/knowledgebase/upload-document-dialog";
import { deleteKnowledgebase } from "@/lib/actions/knowledgebases/delete-knowledgebase";
import { renameKnowledgebase } from "@/lib/actions/knowledgebases/rename-knowledgebase";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import {
  SidebarTabs,
  SidebarTabsList,
  SidebarTabsTrigger,
  SidebarTabsContent,
} from "@/components/shared/sidebar-tabs";
import { useTabState } from "@/hooks/use-tab-state";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { ROUTES } from "@/constants/routes";
import { toast } from "sonner";
import type { KbDocumentRow } from "@/types/kb-document-row";

import { RenameDialog } from "@/components/shared/rename-dialog";
import type { KnowledgebaseRow } from "@/types/knowledgebase-row";
import { AlertTriangle } from "lucide-react";

export default function KnowledgebasePage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;

  const [kb, setKb] = useState<KnowledgebaseRow | null>(null);
  const [embeddingModelLabel, setEmbeddingModelLabel] =
    useState<string>("Not configured");
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<KbDocumentRow[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  const [activeTab, setActiveTab] = useTabState("tab", "documents");

  const fetchKb = useCallback(async () => {
    try {
      const data = await getKnowledgebase(kbId);
      if (data) {
        setKb(data);
      }

      const [settings, embeddingModels] = await Promise.all([
        getUserSettings(),
        listModels({ type: "embedding", isEnabled: true }),
      ]);

      const activeEmbedding =
        embeddingModels.find(
          (model) => model.id === settings?.defaultEmbeddingModelId,
        ) ?? embeddingModels[0];

      setEmbeddingModelLabel(activeEmbedding?.label ?? "Not configured");
    } catch (error) {
      console.error("Failed to fetch knowledgebase:", error);
    } finally {
      setIsLoading(false);
    }
  }, [kbId]);

  const {
    showRename,
    setShowRename,
    showDelete,
    setShowDelete,
    isDeleting,
    handleRename,
    handleDelete,
  } = useEntityOptions({
    id: kbId,
    type: "Knowledgebase",
    onRename: async (id, name) => {
      const result = await renameKnowledgebase(id, name);
      fetchKb();
      return result;
    },
    onDelete: (id) => deleteKnowledgebase(id),
    redirectPath: ROUTES.KNOWLEDGEBASES.path,
    useRouterRefresh: true,
  });

  const fetchDocuments = useCallback(() => {
    listDocuments(kbId)
      .then(setDocuments)
      .catch(() => {});
  }, [kbId, setDocuments]);

  useEffect(() => {
    fetchKb();
    fetchDocuments();
  }, [fetchKb, fetchDocuments]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kb) return <NotFoundMessage entity="Knowledgebase" />;

  const readyCount = documents.filter((d) => d.status === "ready").length;

  return (
    <div className="page-container-detail">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{kb.name}</h1>
        {kb.description && (
          <p className="text-muted-foreground">{kb.description}</p>
        )}
      </div>

      <SidebarTabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <SidebarTabsList>
          <SidebarTabsTrigger value="documents">
            <Library className="mr-2 h-4 w-4" />
            <span>Documents</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="documents" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Card className="flex-1 min-w-[200px] shadow-none">
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold">
                  <FileText className="h-3.5 w-3.5" />
                  Documents
                </CardDescription>
                <div className="flex flex-col gap-0.5 mt-1">
                  <CardTitle className="text-xl font-bold">
                    {documents.length}
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">
                    {documents.length === 0
                      ? "Empty"
                      : `${readyCount} of ${documents.length} ready`}
                  </p>
                </div>
              </CardHeader>
            </Card>

            <Card className="flex-1 min-w-[200px] shadow-none">
              <CardHeader>
                <CardDescription className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold">
                  <Calendar className="h-3.5 w-3.5" />
                  Stats
                </CardDescription>
                <div className="flex flex-col gap-0.5 mt-1">
                  <CardTitle className="text-sm font-medium">
                    Created {format(kb.createdAt, "PPP")}
                  </CardTitle>
                  <p className="text-[10px] text-muted-foreground">
                    Updated {format(kb.updatedAt, "PP")}
                  </p>
                </div>
              </CardHeader>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Documents</h2>
              <Button
                size="sm"
                onClick={() => setShowUpload(true)}
                className="h-8 px-3 text-xs"
              >
                <Upload className="mr-2 h-3.5 w-3.5" />
                Upload
              </Button>
            </div>
            <DocumentList
              documents={documents}
              onDeleted={(id) =>
                setDocuments((prev) => prev.filter((d) => d.id !== id))
              }
            />
          </div>
        </SidebarTabsContent>

        <SidebarTabsContent value="settings" className="space-y-4">
          <Card className="shadow-none">
            <CardHeader className="p-4">
              <CardTitle className="text-base">General Settings</CardTitle>
              <CardDescription className="text-xs">
                Manage basic information for this knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              <div className="p-3 border rounded-lg bg-muted/20 space-y-1">
                <div className="text-xs font-medium">
                  Global Embedding Model
                </div>
                <div className="text-sm text-muted-foreground">
                  {embeddingModelLabel}
                </div>
                {kb.needsReindex === "true" && (
                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Re-index required
                    </div>
                    <p className="mt-1">
                      {kb.reindexReason ?? "Embedding configuration changed."}{" "}
                      Re-upload documents to re-index with the current model.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="space-y-0.5">
                  <div className="text-xs font-medium">Knowledgebase Name</div>
                  <div className="text-sm text-muted-foreground">{kb.name}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setShowRename(true)}
                >
                  Rename
                </Button>
              </div>

              {kb.needsReindex === "true" && (
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setShowUpload(true)}
                >
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  Re-index documents
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/20 shadow-none">
            <CardHeader className="p-4 text-destructive">
              <CardTitle className="text-base">Danger Zone</CardTitle>
              <CardDescription className="text-xs text-destructive/80">
                Irreversible actions for this knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <p className="text-xs text-muted-foreground mb-3">
                Deleting this knowledge base will permanently remove all
                associated documents and vector embeddings. This action cannot
                be undone.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setShowDelete(true)}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete Knowledgebase
              </Button>
            </CardContent>
          </Card>
        </SidebarTabsContent>
      </SidebarTabs>

      <UploadDocumentDialog
        kbId={kbId}
        open={showUpload}
        onOpenChange={setShowUpload}
        onSuccess={(doc) => setDocuments((prev) => [doc, ...prev])}
      />

      <DeleteConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Knowledgebase"
        description={`Are you sure you want to delete "${kb.name}"? This cannot be undone.`}
        loading={isDeleting}
      />

      <RenameDialog
        isOpen={showRename}
        onClose={() => setShowRename(false)}
        initialValue={kb.name}
        onConfirm={handleRename}
        title="Rename Knowledgebase"
      />
    </div>
  );
}
