"use client";

import { Library, Network, Settings, Shield, Upload } from "lucide-react";
import { notFound, useParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteKnowledgebase } from "@/actions/knowledgebases/delete-knowledgebase";
import { getKnowledgebase } from "@/actions/knowledgebases/get-knowledgebase";
import { ingestKbDocument } from "@/actions/knowledgebases/ingest-kb-document";
import { listDocuments } from "@/actions/knowledgebases/list-documents";
import { reindexKnowledgebase } from "@/actions/knowledgebases/reindex-knowledgebase";
import { updateKnowledgebase } from "@/actions/knowledgebases/update-knowledgebase";
import { uploadKbDocument } from "@/actions/knowledgebases/upload-kb-document";
import { listModels } from "@/actions/models/list-models";
import { getUserSettings } from "@/actions/user-settings/get-user-settings";
import { DocumentList } from "@/components/knowledgebase/document-list";
import { KbGraphTab } from "@/components/knowledgebase/kb-graph-tab";
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
import { EntityDetailSkeleton } from "@/components/skeletons/entity-detail-skeleton";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { useEntityOptions } from "@/hooks/use-entity-options";
import { type UserModelOption, useUserModels } from "@/hooks/use-user-models";
import { logger } from "@/lib/logger";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

/**
 * Labels resolved from global settings and enabled models for KB configuration display.
 *
 * @author Maruf Bepary
 */
type KbModelLabels = {
  embeddingModelLabel: string;
  globalKbModelLabel?: string;
};

/**
 * Resolves global embedding and KB metadata model labels.
 *
 * @returns The resolved model labels.
 * @author Maruf Bepary
 */
async function resolveKbModelLabels(): Promise<KbModelLabels> {
  const [settingsRes, embeddingModelsRes, chatModelsRes] = await Promise.all([
    getUserSettings(),
    listModels({ type: "embedding", isEnabled: true }),
    listModels({ type: "chat", isEnabled: true }),
  ]);

  const settings = settingsRes.ok ? settingsRes.value : null;
  const embeddingModels = embeddingModelsRes.ok ? embeddingModelsRes.value : [];
  const chatModels = chatModelsRes.ok ? chatModelsRes.value : [];

  const activeEmbedding =
    embeddingModels.find((m) => m.id === settings?.defaultEmbeddingModelId) ||
    embeddingModels[0];

  const kbDefaultId =
    settings?.defaultKbModelId ?? settings?.defaultChatModelId ?? null;
  const activeKbModel =
    chatModels.find((m) => m.id === kbDefaultId) || chatModels[0];

  return {
    embeddingModelLabel: activeEmbedding?.label ?? "Not configured",
    globalKbModelLabel: activeKbModel?.label,
  };
}

/**
 * Custom hook that provides use knowledgebase detail functionality.
 *
 * @param kbId - Knowledge base unique identifier
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
function useKnowledgebaseDetail(kbId: string) {
  const [kb, setKb] = useState<KnowledgebaseRow | null>(null);
  const [embeddingModelLabel, setEmbeddingModelLabel] =
    useState<string>("Not configured");
  const [globalKbModelLabel, setGlobalKbModelLabel] = useState<
    string | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const fetchKb = useCallback(async () => {
    try {
      const [res, labels] = await Promise.all([
        getKnowledgebase(kbId),
        resolveKbModelLabels(),
      ]);
      if (res.ok) {
        setKb(res.value);
      }
      setEmbeddingModelLabel(labels.embeddingModelLabel);
      setGlobalKbModelLabel(labels.globalKbModelLabel);
    } catch (error) {
      logger.error("Failed to fetch knowledgebase", error);
    } finally {
      setIsLoading(false);
    }
  }, [kbId]);

  const handleReindex = useCallback(async () => {
    if (kb?.indexStatus === "indexing") return;

    try {
      const res = await reindexKnowledgebase(kbId);
      if (res.ok) {
        toast.success("Indexing started");
        fetchKb();
      } else {
        toast.error(res.error.message || "Failed to start re-indexing");
      }
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

  return {
    kb,
    embeddingModelLabel,
    globalKbModelLabel,
    isLoading,
    fetchKb,
    handleReindex,
  };
}

/**
 * Custom hook that provides use knowledgebase documents functionality.
 *
 * @param kbId - Knowledge base unique identifier
 * @param indexStatus - Target index status
 * @param onSettled - Optional callback invoked when in-flight documents finish processing
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
function useKnowledgebaseDocuments(
  kbId: string,
  indexStatus?: string,
  onSettled?: () => void,
) {
  const [documents, setDocuments] = useState<KbDocumentRow[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  // Uploads in flight before the server action returns a persisted row.
  const [pendingUploads, setPendingUploads] = useState<
    { tempId: string; name: string }[]
  >([]);

  const fetchDocuments = useCallback(() => {
    listDocuments(kbId)
      .then((res) => {
        if (res.ok) {
          setDocuments(res.value);
        }
      })
      .catch(() => {});
  }, [kbId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const hasInFlightDocs =
    documents.some(
      (d) => d.status === "pending" || d.status === "processing",
    ) || pendingUploads.length > 0;

  useEffect(() => {
    if (indexStatus !== "indexing" && !hasInFlightDocs) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 1000);

    return () => clearInterval(interval);
  }, [indexStatus, hasInFlightDocs, fetchDocuments]);

  const prevInFlightRef = useRef(false);
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    if (prevInFlightRef.current && !hasInFlightDocs) {
      onSettledRef.current?.();
    }
    prevInFlightRef.current = hasInFlightDocs;
  }, [hasInFlightDocs]);

  const handleDeleted = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleUploadFile = useCallback(
    async (file: File) => {
      const tempId = crypto.randomUUID();
      setPendingUploads((prev) => [...prev, { tempId, name: file.name }]);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("kbId", kbId);

        const uploadRes = await uploadKbDocument(formData);
        if (!uploadRes.ok) {
          toast.error(uploadRes.error.message || "Upload failed");
          return;
        }

        const doc = uploadRes.value;
        setPendingUploads((prev) =>
          prev.filter((item) => item.tempId !== tempId),
        );

        const ingestRes = await ingestKbDocument(doc.id);
        if (!ingestRes.ok) {
          const errMsg = ingestRes.error.message || "Ingestion failed";
          setDocuments((prev) => [
            {
              ...doc,
              status: "failed",
              statusMessage: errMsg,
            },
            ...prev,
          ]);
          return;
        }

        toast.success(`"${file.name}" uploaded and queued for processing`);
        setDocuments((prev) => [doc, ...prev]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        toast.error(msg);
      } finally {
        setPendingUploads((prev) =>
          prev.filter((item) => item.tempId !== tempId),
        );
      }
    },
    [kbId],
  );

  // Placeholder rows for uploads awaiting their persisted server row.
  // shortcut: fabricated minimal rows (no s3Key/userId) exist only until the
  // upload action returns; upgrade path is server-sent events if the upload
  // window grows beyond the action round-trip.
  const pendingRows: KbDocumentRow[] = pendingUploads.map((upload) => ({
    id: upload.tempId,
    kbId,
    userId: "",
    name: upload.name,
    mimeType: "",
    size: 0,
    s3Key: "",
    status: "pending",
    statusMessage: null,
    chunkCount: 0,
    tokenCount: 0,
    truncated: false,
    documentType: "general",
    summary: "",
    keyEntities: [],
    tableOfContents: [],
    ingestSteps: {
      uploading: { status: "loading" },
      extracting: { status: "pending" },
      embedding: { status: "pending" },
      metadata: { status: "pending" },
      relations: { status: "pending" },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  return {
    documents,
    displayDocuments: [...pendingRows, ...documents],
    hasInFlightDocs,
    showUpload,
    setShowUpload,
    handleDeleted,
    handleUploadFile,
  };
}

/**
 * Custom hook that provides use knowledgebase settings functionality.
 *
 * @param kb - Target kb
 * @param onSaved - Target on saved
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
function useKnowledgebaseSettings(
  kb: KnowledgebaseRow | null,
  onSaved: () => void,
) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metadataModelId, setMetadataModelId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (kb) {
      setName(kb.name);
      setDescription(kb.description ?? "");
      setMetadataModelId(kb.metadataModelId ?? null);
    }
  }, [kb]);

  const handleSaveSettings = async () => {
    if (!kb) return;
    setIsSaving(true);
    try {
      const res = await updateKnowledgebase(kb.id, {
        name,
        description,
        metadataModelId,
      });
      if (!res.ok) {
        toast.error(res.error.message || "Failed to save settings");
        return;
      }
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
    metadataModelId,
    setMetadataModelId,
    isSaving,
    handleSaveSettings,
  };
}

/**
 * Custom hook that provides use knowledgebase page state functionality.
 *
 * @param kbId - Knowledge base unique identifier
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
function useKnowledgebasePageState(kbId: string) {
  const detail = useKnowledgebaseDetail(kbId);
  const docs = useKnowledgebaseDocuments(
    kbId,
    detail.kb?.indexStatus,
    detail.fetchKb,
  );
  const settings = useKnowledgebaseSettings(detail.kb, detail.fetchKb);
  const deletion = useEntityOptions({
    id: kbId,
    type: "Knowledgebase",
    onDelete: (id) => deleteKnowledgebase(id),
    redirectPath: ROUTES.KNOWLEDGEBASES.path,
    useRouterRefresh: true,
  });

  const { models, isLoading: isModelsLoading } = useUserModels("embedding");
  const { models: chatModels } = useUserModels("chat");
  const hasNoModels = !isModelsLoading && models.length === 0;

  const hasAutoTriggeredReindexRef = useRef(false);

  useEffect(() => {
    if (
      detail.kb?.indexStatus === "stale" &&
      !hasAutoTriggeredReindexRef.current &&
      !docs.hasInFlightDocs
    ) {
      hasAutoTriggeredReindexRef.current = true;
      detail.handleReindex();
    }
  }, [detail.kb?.indexStatus, detail.handleReindex, docs.hasInFlightDocs]);

  return {
    ...detail,
    docs,
    settings,
    deletion,
    chatModels,
    isUploadDisabled: isModelsLoading || hasNoModels,
    hasNoModels,
  };
}

/**
 * Represents knowledgebase page tabs props.
 *
 * @author Maruf Bepary
 */
type KnowledgebasePageTabsProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  kb: KnowledgebaseRow;
  documents: KbDocumentRow[];
  displayDocuments: KbDocumentRow[];
  onReindex: () => void;
  onOpenUpload: () => void;
  onDocumentDeleted: (id: string) => void;
  isUploadDisabled: boolean;
  settings: ReturnType<typeof useKnowledgebaseSettings>;
  chatModels: UserModelOption[];
  embeddingModelLabel: string;
  globalKbModelLabel?: string;
  onDeleteClick: () => void;
  isDeleting: boolean;
};

/**
 * Renders the knowledgebase page tabs component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function KnowledgebasePageTabs(props: KnowledgebasePageTabsProps) {
  const {
    activeTab,
    setActiveTab,
    kb,
    documents,
    displayDocuments,
    onReindex,
    onOpenUpload,
    onDocumentDeleted,
    isUploadDisabled,
    settings,
    chatModels,
    embeddingModelLabel,
    globalKbModelLabel,
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
        <SidebarTabsTrigger value="graph">
          <Network className="mr-2 h-4 w-4" />
          <span>Graph</span>
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
            <h2 className="text-base font-semibold">Documents</h2>
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
          <DocumentList
            documents={displayDocuments}
            onDeleted={onDocumentDeleted}
          />
        </div>
      </SidebarTabsContent>

      <SidebarTabsContent value="graph" className="w-full min-w-0 flex-1">
        <KbGraphTab kbId={kb.id} />
      </SidebarTabsContent>

      <SidebarTabsContent value="settings">
        <KbSettingsTab
          name={settings.name}
          onNameChange={settings.setName}
          description={settings.description}
          onDescriptionChange={settings.setDescription}
          metadataModelId={settings.metadataModelId}
          onMetadataModelChange={settings.setMetadataModelId}
          chatModels={chatModels}
          globalKbModelLabel={globalKbModelLabel}
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

/**
 * Renders the knowledgebase header component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function KnowledgebaseHeader({ kb }: { kb: KnowledgebaseRow }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold">{kb.name}</h1>
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

  if (kbId === "new") {
    notFound();
  }

  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("documents").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const state = useKnowledgebasePageState(kbId);

  if (state.isLoading) {
    return <EntityDetailSkeleton />;
  }

  if (!state.kb) {
    notFound();
  }

  return (
    <PageContainer
      variant={activeTab === "graph" ? "wide" : "default"}
      className="space-y-6"
    >
      <KnowledgebaseHeader kb={state.kb} />

      {state.hasNoModels ? (
        <NoModelsAlertBanner message="No embedding models configured. Please set up a provider with embedding support to upload documents." />
      ) : null}

      <KnowledgebasePageTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        kb={state.kb}
        documents={state.docs.documents}
        displayDocuments={state.docs.displayDocuments}
        onReindex={state.handleReindex}
        onOpenUpload={() => state.docs.setShowUpload(true)}
        onDocumentDeleted={state.docs.handleDeleted}
        isUploadDisabled={state.isUploadDisabled}
        settings={state.settings}
        chatModels={state.chatModels}
        embeddingModelLabel={state.embeddingModelLabel}
        globalKbModelLabel={state.globalKbModelLabel}
        onDeleteClick={() => state.deletion.setShowDelete(true)}
        isDeleting={state.deletion.isDeleting}
      />

      <UploadDocumentDialog
        open={state.docs.showUpload}
        onOpenChange={state.docs.setShowUpload}
        onUpload={state.docs.handleUploadFile}
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
