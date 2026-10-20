"use client";

import { Library, Loader2, Settings, Shield, Upload } from "lucide-react";
import { notFound, useParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { deleteKnowledgebase } from "@/actions/knowledgebases/delete-knowledgebase";
import { getKnowledgebase } from "@/actions/knowledgebases/get-knowledgebase";
import { listDocuments } from "@/actions/knowledgebases/list-documents";
import { reindexKnowledgebase } from "@/actions/knowledgebases/reindex-knowledgebase";
import { updateKnowledgebase } from "@/actions/knowledgebases/update-knowledgebase";
import { listModels } from "@/actions/models/list-models";
import { getUserSettings } from "@/actions/user-settings/get-user-settings";
import { DocumentList } from "@/components/knowledgebase/document-list";
import { KbSettingsTab } from "@/components/knowledgebase/kb-settings-tab";
import { KbStatsCards } from "@/components/knowledgebase/kb-stats-cards";
import { UploadDocumentDialog } from "@/components/knowledgebase/upload-document-dialog";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { NoModelsAlertBanner } from "@/components/shared/no-models-alert-banner";
import { PageContainer } from "@/components/shared/page-container";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { useUserModels } from "@/hooks/use-user-models";
import { logger } from "@/lib/logger";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

async function resolveEmbeddingModelLabel(): Promise<string> {
  const [settings, embeddingModels] = await Promise.all([
    getUserSettings(),
    listModels({ type: "embedding", isEnabled: true }),
  ]);

  const defaultId = settings?.defaultEmbeddingModelId;
  const activeEmbedding =
    embeddingModels.find((m) => m.id === defaultId) || embeddingModels[0];

  if (!activeEmbedding) {
    return "Not configured";
  }

  return activeEmbedding.label;
}

function useKnowledgebaseDetail(kbId: string) {
  const [kb, setKb] = useState<KnowledgebaseRow | null>(null);
  const [embeddingModelLabel, setEmbeddingModelLabel] =
    useState<string>("Not configured");
  const [isLoading, setIsLoading] = useState(true);

  const fetchKb = useCallback(async () => {
    try {
      const [data, label] = await Promise.all([
        getKnowledgebase(kbId),
        resolveEmbeddingModelLabel(),
      ]);
      if (data) {
        setKb(data);
      }
      setEmbeddingModelLabel(label);
    } catch (error) {
      logger.error("Failed to fetch knowledgebase", error);
    } finally {
      setIsLoading(false);
    }
  }, [kbId]);

  const handleReindex = useCallback(async () => {
    if (kb?.indexStatus === "indexing") return;

    try {
      await reindexKnowledgebase(kbId);
      toast.success("Indexing started");
      fetchKb();
    } catch (error) {
      toast.error("Failed to start re-indexing");
      logger.error("Knowledgebase error", error);
    }
  }, [kbId, kb?.indexStatus, fetchKb]);

  useEffect(() => {
    fetchKb();
  }, [fetchKb]);

  useEffect(() => {
    if (kb?.indexStatus !== "indexing") return;

    const interval = setInterval(() => {
      fetchKb();
    }, 3000);

    return () => clearInterval(interval);
  }, [kb?.indexStatus, fetchKb]);

  useEffect(() => {
    if (kb?.indexStatus === "stale") {
      handleReindex();
    }
  }, [kb?.indexStatus, handleReindex]);

  return {
    kb,
    embeddingModelLabel,
    isLoading,
    fetchKb,
    handleReindex,
  };
}

function useKnowledgebaseDocuments(kbId: string, indexStatus?: string) {
  const [documents, setDocuments] = useState<KbDocumentRow[]>([]);
  const [showUpload, setShowUpload] = useState(false);

  const fetchDocuments = useCallback(() => {
    listDocuments(kbId)
      .then(setDocuments)
      .catch(() => {});
  }, [kbId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (indexStatus !== "indexing") return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [indexStatus, fetchDocuments]);

  const handleDeleted = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleUploadSuccess = useCallback((doc: KbDocumentRow) => {
    setDocuments((prev) => [doc, ...prev]);
  }, []);

  return {
    documents,
    showUpload,
    setShowUpload,
    handleDeleted,
    handleUploadSuccess,
  };
}

function useKnowledgebaseSettings(
  kb: KnowledgebaseRow | null,
  onSaved: () => void,
) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (kb) {
      setName(kb.name);
      setDescription(kb.description ?? "");
    }
  }, [kb]);

  const handleSaveSettings = async () => {
    if (!kb) return;
    setIsSaving(true);
    try {
      await updateKnowledgebase(kb.id, {
        name,
        description,
      });
      toast.success("Settings saved");
      onSaved();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    name,
    setName,
    description,
    setDescription,
    isSaving,
    handleSaveSettings,
  };
}

function useKnowledgebasePageState(kbId: string) {
  const detail = useKnowledgebaseDetail(kbId);
  const docs = useKnowledgebaseDocuments(kbId, detail.kb?.indexStatus);
  const settings = useKnowledgebaseSettings(detail.kb, detail.fetchKb);
  const deletion = useEntityOptions({
    id: kbId,
    type: "Knowledgebase",
    onDelete: (id) => deleteKnowledgebase(id),
    redirectPath: ROUTES.KNOWLEDGEBASES.path,
    useRouterRefresh: true,
  });

  const { models, isLoading: isModelsLoading } = useUserModels("embedding");
  const hasNoModels = !isModelsLoading && models.length === 0;

  return {
    ...detail,
    docs,
    settings,
    deletion,
    isUploadDisabled: isModelsLoading || hasNoModels,
    hasNoModels,
  };
}

type KnowledgebasePageTabsProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  kb: KnowledgebaseRow;
  documents: KbDocumentRow[];
  onReindex: () => void;
  onOpenUpload: () => void;
  onDocumentDeleted: (id: string) => void;
  isUploadDisabled: boolean;
  settings: ReturnType<typeof useKnowledgebaseSettings>;
  embeddingModelLabel: string;
  onDeleteClick: () => void;
  isDeleting: boolean;
};

function KnowledgebasePageTabs(props: KnowledgebasePageTabsProps) {
  const {
    activeTab,
    setActiveTab,
    kb,
    documents,
    onReindex,
    onOpenUpload,
    onDocumentDeleted,
    isUploadDisabled,
    settings,
    embeddingModelLabel,
    onDeleteClick,
    isDeleting,
  } = props;

  return (
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
        <KbStatsCards kb={kb} documents={documents} onReindex={onReindex} />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Documents</h2>
            <Button
              size="sm"
              onClick={onOpenUpload}
              className="h-8 px-3 text-xs"
              disabled={isUploadDisabled}
            >
              <Upload className="mr-2 h-3.5 w-3.5" />
              Upload
            </Button>
          </div>
          <DocumentList documents={documents} onDeleted={onDocumentDeleted} />
        </div>
      </SidebarTabsContent>

      <SidebarTabsContent value="settings">
        <KbSettingsTab
          name={settings.name}
          onNameChange={settings.setName}
          description={settings.description}
          onDescriptionChange={settings.setDescription}
          onSave={settings.handleSaveSettings}
          isSaving={settings.isSaving}
          embeddingModelLabel={embeddingModelLabel}
          kb={kb}
          onReindex={onReindex}
        />
      </SidebarTabsContent>

      <SidebarTabsContent value="danger">
        <DangerZoneCard
          title="Delete Knowledgebase"
          description="Once you delete a knowledge base, there is no going back. Please be certain."
          consequences="Deleting this knowledge base will permanently remove all associated documents and vector embeddings from our system."
          buttonLabel="Delete Knowledgebase"
          onDelete={onDeleteClick}
          isDeleting={isDeleting}
        />
      </SidebarTabsContent>
    </SidebarTabs>
  );
}

function KnowledgebaseHeader({ kb }: { kb: KnowledgebaseRow }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="font-bold text-2xl">{kb.name}</h1>
      {kb.description ? (
        <p className="text-muted-foreground">{kb.description}</p>
      ) : null}
    </div>
  );
}

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
  const kbId = params.id as string;

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("documents").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const state = useKnowledgebasePageState(kbId);

  if (state.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.kb) {
    notFound();
  }

  return (
    <PageContainer variant="narrow" className="space-y-6">
      <KnowledgebaseHeader kb={state.kb} />

      {state.hasNoModels ? (
        <NoModelsAlertBanner message="No embedding models configured. Please set up a provider with embedding support to upload documents." />
      ) : null}

      <KnowledgebasePageTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        kb={state.kb}
        documents={state.docs.documents}
        onReindex={state.handleReindex}
        onOpenUpload={() => state.docs.setShowUpload(true)}
        onDocumentDeleted={state.docs.handleDeleted}
        isUploadDisabled={state.isUploadDisabled}
        settings={state.settings}
        embeddingModelLabel={state.embeddingModelLabel}
        onDeleteClick={() => state.deletion.setShowDelete(true)}
        isDeleting={state.deletion.isDeleting}
      />

      <UploadDocumentDialog
        kbId={kbId}
        open={state.docs.showUpload}
        onOpenChange={state.docs.setShowUpload}
        onSuccess={state.docs.handleUploadSuccess}
      />

      <DeleteConfirmDialog
        isOpen={state.deletion.showDelete}
        onClose={() => state.deletion.setShowDelete(false)}
        onConfirm={state.deletion.handleDelete}
        title="Delete Knowledgebase"
        description={`Are you sure you want to delete "${state.kb.name}"? This cannot be undone.`}
        loading={state.deletion.isDeleting}
      />
    </PageContainer>
  );
}
