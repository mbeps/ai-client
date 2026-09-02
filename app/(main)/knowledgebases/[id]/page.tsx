"use client";

import {
  AlertCircle,
  Library,
  Loader2,
  Settings,
  Shield,
  Upload,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DocumentList } from "@/components/knowledgebase/document-list";
import { KbSettingsTab } from "@/components/knowledgebase/kb-settings-tab";
import { KbStatsCards } from "@/components/knowledgebase/kb-stats-cards";
import { UploadDocumentDialog } from "@/components/knowledgebase/upload-document-dialog";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { useUserModels } from "@/hooks/use-user-models";
import { deleteKnowledgebase } from "@/lib/actions/knowledgebases/delete-knowledgebase";
import { getKnowledgebase } from "@/lib/actions/knowledgebases/get-knowledgebase";
import { listDocuments } from "@/lib/actions/knowledgebases/list-documents";
import { reindexKnowledgebase } from "@/lib/actions/knowledgebases/reindex-knowledgebase";
import { updateKnowledgebase } from "@/lib/actions/knowledgebases/update-knowledgebase";
import { listModels } from "@/lib/actions/models/list-models";
import { getUserSettings } from "@/lib/actions/user-settings/get-user-settings";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

/**
 * Knowledgebase detail page: Upload documents and manage embeddings.
 *
 * Route: /knowledgebases/[id]. Displays KB metadata, lists documents with upload UI,
 * and provides reindexing/deletion controls. Uses SidebarTabs for Overview/Documents/Settings.
 * Handles document upload, embedding status tracking, and KB lifecycle management.
 *
 * @author Maruf Bepary
 */
export default function KnowledgebasePage() {
  const params = useParams();
  const router = useRouter();
  const kbId = params.id as string;

  const { models } = useUserModels("embedding");
  const hasNoModels = models.length === 0;

  const [kb, setKb] = useState<KnowledgebaseRow | null>(null);
  const [embeddingModelLabel, setEmbeddingModelLabel] =
    useState<string>("Not configured");
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<KbDocumentRow[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("documents").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const fetchKb = useCallback(async () => {
    try {
      const data = await getKnowledgebase(kbId);
      if (data) {
        setKb(data);
        setName(data.name);
        setDescription(data.description ?? "");
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

  const { showDelete, setShowDelete, isDeleting, handleDelete } =
    useEntityOptions({
      id: kbId,
      type: "Knowledgebase",
      onDelete: (id) => deleteKnowledgebase(id),
      redirectPath: ROUTES.KNOWLEDGEBASES.path,
      useRouterRefresh: true,
    });

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateKnowledgebase(kbId, {
        name,
        description,
      });
      toast.success("Settings saved");
      fetchKb();
      router.refresh();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const fetchDocuments = useCallback(() => {
    listDocuments(kbId)
      .then(setDocuments)
      .catch(() => {});
  }, [kbId]);

  useEffect(() => {
    fetchKb();
    fetchDocuments();
  }, [fetchKb, fetchDocuments]);

  const handleReindex = useCallback(async () => {
    if (kb?.indexStatus === "indexing") return;

    try {
      await reindexKnowledgebase(kbId);
      toast.success("Indexing started");
      fetchKb();
    } catch (error) {
      toast.error("Failed to start re-indexing");
      console.error(error);
    }
  }, [kbId, kb?.indexStatus, fetchKb]);

  // Polling for status updates
  useEffect(() => {
    if (kb?.indexStatus !== "indexing") return;

    const interval = setInterval(() => {
      fetchKb();
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [kb?.indexStatus, fetchKb, fetchDocuments]);

  // Lazy trigger: if stale, start indexing automatically
  useEffect(() => {
    if (kb?.indexStatus === "stale") {
      handleReindex();
    }
  }, [kb?.indexStatus, handleReindex]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!kb) {
    notFound();
  }

  return (
    <div className="page-container-detail">
      <div className="flex flex-col gap-1">
        <h1 className="font-bold text-2xl">{kb.name}</h1>
        {kb.description && (
          <p className="text-muted-foreground">{kb.description}</p>
        )}
      </div>

      {hasNoModels && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <p className="font-medium text-red-800 text-xs dark:text-red-200">
              No embedding models configured. Please set up a provider with
              embedding support to upload documents.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-red-200 text-[10px] hover:bg-red-100 dark:border-red-900 dark:hover:bg-red-900/40"
            onClick={() => router.push(ROUTES.SETTINGS.PROVIDERS.path)}
          >
            <Settings className="mr-1.5 h-3 w-3" />
            Go to Settings
          </Button>
        </div>
      )}

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
          <SidebarTabsTrigger value="danger">
            <Shield className="mr-2 h-4 w-4" />
            <span>Danger Zone</span>
          </SidebarTabsTrigger>
        </SidebarTabsList>

        <SidebarTabsContent value="documents" className="space-y-4">
          <KbStatsCards
            kb={kb}
            documents={documents}
            onReindex={handleReindex}
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base">Documents</h2>
              <Button
                size="sm"
                onClick={() => setShowUpload(true)}
                className="h-8 px-3 text-xs"
                disabled={hasNoModels}
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

        <SidebarTabsContent value="settings">
          <KbSettingsTab
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            onSave={handleSaveSettings}
            isSaving={isSaving}
            embeddingModelLabel={embeddingModelLabel}
            kb={kb}
            onReindex={handleReindex}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="danger">
          <DangerZoneCard
            title="Delete Knowledgebase"
            description="Once you delete a knowledge base, there is no going back. Please be certain."
            consequences="Deleting this knowledge base will permanently remove all associated documents and vector embeddings from our system."
            buttonLabel="Delete Knowledgebase"
            onDelete={() => setShowDelete(true)}
            isDeleting={isDeleting}
          />
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
    </div>
  );
}
