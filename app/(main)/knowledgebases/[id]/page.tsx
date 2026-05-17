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
import {
  FileText,
  Calendar,
  Upload,
  Settings,
  Trash2,
  Library,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { listDocuments } from "@/lib/actions/knowledgebases/list-documents";
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

export default function KnowledgebasePage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;
  const knowledgebases = useAppStore((state) => state.knowledgebases);
  const kb = knowledgebases.find((k) => k.id === kbId);
  const loadKnowledgebases = useAppStore((state) => state.loadKnowledgebases);
  const [documents, setDocuments] = useState<KbDocumentRow[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  const [activeTab, setActiveTab] = useTabState("tab", "documents");

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
    onRename: renameKnowledgebase,
    onDelete: (id) => deleteKnowledgebase(id),
    redirectPath: ROUTES.KNOWLEDGEBASES.path,
    useRouterRefresh: true,
    onAfterMutation: loadKnowledgebases,
  });

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

        <SidebarTabsContent value="documents" className="space-y-6">
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
        </SidebarTabsContent>

        <SidebarTabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Manage basic information for this knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <div className="font-medium">Knowledgebase Name</div>
                  <div className="text-sm text-muted-foreground">{kb.name}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRename(true)}
                >
                  Rename
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions for this knowledge base.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Deleting this knowledge base will permanently remove all
                associated documents and vector embeddings. This action cannot
                be undone.
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDelete(true)}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
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
