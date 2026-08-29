"use client";

import { toggleSetItem } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { ROUTES } from "@/constants/routes";
import {
  ArrowLeft,
  Save,
  Zap,
  Loader2,
  Settings,
  Database,
  List,
  Shield,
  History,
  AlertCircle,
  FileText,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { toast } from "sonner";
import { getTransformAgent } from "@/lib/actions/transform-agents/get-transform-agent";
import { createTransformAgent } from "@/lib/actions/transform-agents/create-transform-agent";
import { updateTransformAgent } from "@/lib/actions/transform-agents/update-transform-agent";
import { uploadRunInput } from "@/lib/actions/transform-runs/upload-run-input";
import { createTransformRun } from "@/lib/actions/transform-runs/create-transform-run";
import { listTransformRuns } from "@/lib/actions/transform-runs/list-transform-runs";
import { deleteTransformAgent } from "@/lib/actions/transform-agents/delete-transform-agent";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { DangerZoneCard } from "@/components/shared/danger-zone-card";
import { TransformRunDialog } from "@/components/workflows/sheet-flow/transform-run-dialog";
import { TransformStepsTab } from "@/components/workflows/sheet-flow/transform-steps-tab";
import { TransformContextTab } from "@/components/workflows/sheet-flow/transform-context-tab";
import { TransformConfigTab } from "@/components/workflows/sheet-flow/transform-config-tab";
import { TransformRunsTab } from "@/components/workflows/sheet-flow/transform-runs-tab";

import { type TransformStep } from "@/types/transform/transform-step";
import type { TransformRunRow } from "@/types/transform/transform-run-row";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { KnowledgebasePicker } from "@/components/chat/knowledgebase-picker";
import { useApiError } from "@/hooks/use-api-error";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { useUserModels } from "@/hooks/use-user-models";

/**
 * Transform agent editor page supporting create/edit/delete operations.
 * Client component managing agent configuration including steps, tools, knowledge bases, and model selection.
 * Provides tabbed interface for step definition, global prompt, knowledge base selection, tool configuration, and run history.
 * Integrates with transform run creation and file upload functionality.
 *
 * @author Maruf Bepary
 */
export default function AgentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { handleApiError } = useApiError();
  const id = params.id as string;
  const isNew = id === "new";

  const { mcpServers, loadMcpServers } = useAppStore();
  const { normalizedKnowledgebases: knowledgebases } = useKnowledgebases();
  const { models: chatModels } = useUserModels("chat");
  const hasNoModels = chatModels.length === 0;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [globalContext, setGlobalContext] = useState("");
  const [modelId, setModelId] = useState<string>("");
  const [tools, setTools] = useState<Set<string>>(new Set());
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<Set<string>>(
    new Set(),
  );
  const [requiresFileUpload, setRequiresFileUpload] = useState(true);
  const [steps, setSteps] = useState<TransformStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [runs, setRuns] = useState<TransformRunRow[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("steps").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  // Run dialog state
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runFiles, setRunFiles] = useState<File[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [isStartingRun, setIsStartingRun] = useState(false);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load MCP servers if empty
  useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers();
    }
  }, [mcpServers.length, loadMcpServers]);

  // Load agent data if editing
  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    async function loadAgent() {
      try {
        const agent = await getTransformAgent(id);
        if (!agent && mounted) {
          toast.error("Agent not found");
          router.push(ROUTES.WORKFLOWS.TRANSFORM.path);
          return;
        }
        if (agent && mounted) {
          setName(agent.name);
          setDescription(agent.description ?? "");
          setGlobalContext(agent.globalContext ?? "");
          setModelId(agent.modelId ?? "");
          setTools(new Set(agent.tools ?? []));
          setKnowledgeBaseIds(new Set(agent.knowledgeBaseIds ?? []));
          setRequiresFileUpload(agent.requiresFileUpload);
          const rawSteps =
            typeof agent.steps === "string"
              ? JSON.parse(agent.steps)
              : agent.steps;
          setSteps(
            (rawSteps ?? []).map((step: any, i: number) => ({
              id: step.id || crypto.randomUUID(),
              name: step.name || `Step ${i + 1}`,
              prompt: step.prompt || "",
              mcpServerIds: step.mcpServerIds ?? [],
              toolIds: step.toolIds ?? [],
              order: step.order ?? i,
              requiresReview: Boolean(step.requiresReview),
            })),
          );
        }
      } catch (err) {
        handleApiError(err, "Failed to load agent");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadAgent();
    return () => {
      mounted = false;
    };
  }, [id, isNew, router, handleApiError]);

  // Load runs if editing
  useEffect(() => {
    if (isNew) return;

    let mounted = true;
    async function loadRuns() {
      setIsLoadingRuns(true);
      try {
        const result = await listTransformRuns(id);
        if (mounted) setRuns(result);
      } catch (err) {
        handleApiError(err, "Failed to load runs");
      } finally {
        if (mounted) setIsLoadingRuns(false);
      }
    }

    loadRuns();
    return () => {
      mounted = false;
    };
  }, [id, isNew, handleApiError]);

  const addStep = () => {
    const newStep: TransformStep = {
      id: crypto.randomUUID(),
      name: `Step ${steps.length + 1}`,
      prompt: "",
      mcpServerIds: [],
      toolIds: [],
      order: steps.length,
      requiresReview: false,
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (index: number, updates: Partial<TransformStep>) => {
    setSteps(steps.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const toggleTool = (serverId: string, toolName: string) => {
    const toolId = `${serverId}:tool:${toolName}`;
    setTools((prev) => toggleSetItem(prev, toolId));
  };

  const toggleAllTools = (
    serverId: string,
    toolNames: string[],
    enabled: boolean,
  ) => {
    setTools((prev) => {
      const next = new Set(prev);
      toolNames.forEach((name) => {
        const toolId = `${serverId}:tool:${name}`;
        if (enabled) {
          next.add(toolId);
        } else {
          next.delete(toolId);
        }
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter an agent name");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name,
        description: description.trim() || undefined,
        globalContext: globalContext.trim() || undefined,
        modelId: modelId.trim() || undefined,
        tools: Array.from(tools),
        knowledgeBaseIds: Array.from(knowledgeBaseIds),
        requiresFileUpload,
        steps: steps.map((s, i) => ({
          id: s.id,
          name: s.name,
          prompt: s.prompt,
          mcpServerIds: s.mcpServerIds,
          toolIds: s.toolIds,
          order: i,
          requiresReview: s.requiresReview,
        })),
      };

      if (isNew) {
        const created = await createTransformAgent(payload);
        toast.success("Agent created successfully");
        router.push(ROUTES.WORKFLOWS.TRANSFORM.detail(created.id));
      } else {
        await updateTransformAgent(id, payload);
        toast.success("Agent updated successfully");
      }
    } catch (err) {
      handleApiError(err, "Failed to save agent");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartRun = async () => {
    if (requiresFileUpload && runFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setIsStartingRun(true);
    try {
      let inputAttachmentIds: string[] = [];

      if (runFiles.length > 0) {
        const formData = new FormData();
        runFiles.forEach((file) => formData.append("files", file));
        const uploaded = await uploadRunInput(formData);
        inputAttachmentIds = uploaded.map((u) => u.id);
      }

      const run = await createTransformRun({
        agentId: id,
        dryRun,
        inputAttachmentIds,
      });

      toast.success("Run started successfully");
      setRunDialogOpen(false);
      setRunFiles([]);
      router.push(ROUTES.WORKFLOWS.TRANSFORM.runs(id, run.id));
    } catch (err) {
      handleApiError(err, "Failed to start run");
    } finally {
      setIsStartingRun(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTransformAgent(id);
      toast.success("Agent deleted successfully");
      router.push(ROUTES.WORKFLOWS.TRANSFORM.path);
    } catch (err) {
      handleApiError(err, "Failed to delete agent");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="page-container-detail">
      <div className="flex items-center gap-4">
        <Link href={ROUTES.WORKFLOWS.TRANSFORM.path}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {isNew ? "New Transform Agent" : name || "Untitled Agent"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {isNew
                ? "Configure a multi-step document transformation workflow"
                : `${steps.length} step${steps.length !== 1 ? "s" : ""} configured`}
            </p>
          </div>
        </div>

        <div className="ml-auto flex gap-2">
          {!isNew && (
            <TransformRunDialog
              open={runDialogOpen}
              onOpenChange={setRunDialogOpen}
              requiresFileUpload={requiresFileUpload}
              runFiles={runFiles}
              onRunFilesChange={setRunFiles}
              dryRun={dryRun}
              onDryRunChange={setDryRun}
              onStartRun={handleStartRun}
              isStartingRun={isStartingRun}
              disabled={hasNoModels}
            />
          )}
          <Button onClick={handleSave} disabled={isSaving || hasNoModels}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Agent
          </Button>
        </div>
      </div>

      {hasNoModels && (
        <div className="flex items-center justify-between gap-3 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <p className="text-xs font-medium text-red-800 dark:text-red-200">
              No chat models configured. Please set up a provider to configure
              and run transform agents.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[10px] border-red-200 hover:bg-red-100 dark:border-red-900 dark:hover:bg-red-900/40"
            onClick={() => router.push(ROUTES.SETTINGS.PROVIDERS.path)}
          >
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
          <SidebarTabsTrigger value="steps">
            <List className="mr-2 h-4 w-4" />
            <span>Steps ({steps.length})</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="prompt">
            <FileText className="mr-2 h-4 w-4" />
            <span>Global Context</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="knowledge">
            <Database className="mr-2 h-4 w-4" />
            <span>Knowledge Bases</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="tools">
            <Wrench className="mr-2 h-4 w-4" />
            <span>Tools</span>
          </SidebarTabsTrigger>
          {!isNew && (
            <SidebarTabsTrigger value="runs">
              <History className="mr-2 h-4 w-4" />
              <span>Runs ({runs.length})</span>
            </SidebarTabsTrigger>
          )}
          <SidebarTabsTrigger value="config">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </SidebarTabsTrigger>
          {!isNew && (
            <SidebarTabsTrigger value="danger">
              <Shield className="mr-2 h-4 w-4" />
              <span>Danger Zone</span>
            </SidebarTabsTrigger>
          )}
        </SidebarTabsList>

        <SidebarTabsContent value="steps">
          <TransformStepsTab
            steps={steps}
            onAddStep={addStep}
            onUpdateStep={updateStep}
            onRemoveStep={removeStep}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="prompt">
          <TransformContextTab
            globalContext={globalContext}
            onGlobalContextChange={setGlobalContext}
          />
        </SidebarTabsContent>

        <SidebarTabsContent value="knowledge" className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Knowledge Bases</h3>
            <p className="text-sm text-muted-foreground">
              Select knowledge bases to provide additional context for this
              transformation agent.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <KnowledgebasePicker
              knowledgebases={knowledgebases}
              selectedIds={knowledgeBaseIds}
              onSelect={setKnowledgeBaseIds}
              mode="multiple"
              allowEmpty={false}
            />
          </div>
        </SidebarTabsContent>

        <SidebarTabsContent value="tools" className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Default Tools</h3>
            <p className="text-sm text-muted-foreground">
              These tools will be automatically enabled for all steps in this
              transformation.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <ToolPickerList
              servers={mcpServers}
              selectedTools={tools}
              onToggleTool={toggleTool}
              onBulkSelect={toggleAllTools}
            />
          </div>
        </SidebarTabsContent>

        {!isNew && (
          <SidebarTabsContent value="runs">
            <TransformRunsTab
              runs={runs}
              agentId={id}
              isLoading={isLoadingRuns}
            />
          </SidebarTabsContent>
        )}

        <SidebarTabsContent value="config">
          <TransformConfigTab
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            modelId={modelId}
            onModelIdChange={setModelId}
            requiresFileUpload={requiresFileUpload}
            onRequiresFileUploadChange={setRequiresFileUpload}
          />
        </SidebarTabsContent>

        {!isNew && (
          <SidebarTabsContent value="danger">
            <DangerZoneCard
              title="Danger Zone"
              description="Irreversible actions for this transform agent."
              consequences="Deleting this agent will permanently remove its configuration and steps. Past runs will be preserved but dissociated. This action cannot be undone."
              buttonLabel="Delete Agent"
              onDelete={() => setShowDeleteDialog(true)}
              isDeleting={isDeleting}
            />
          </SidebarTabsContent>
        )}
      </SidebarTabs>

      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title={`Delete "${name}"?`}
        description="This will permanently delete the transform agent and its configuration. This cannot be undone."
        loading={isDeleting}
      />
    </div>
  );
}
