"use client";

import { PageHeader } from "@/components/page-header";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SidebarTabs,
  SidebarTabsContent,
  SidebarTabsList,
  SidebarTabsTrigger,
} from "@/components/shared/sidebar-tabs";
import { ROUTES } from "@/constants/routes";
import {
  ArrowLeft,
  Plus,
  Save,
  Trash2,
  Zap,
  Play,
  Loader2,
  Settings,
  Database,
  List,
  Shield,
  History,
  Edit2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTabState } from "@/hooks/use-tab-state";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getTransformAgent } from "@/lib/actions/transform-agents/get-transform-agent";
import { createTransformAgent } from "@/lib/actions/transform-agents/create-transform-agent";
import { updateTransformAgent } from "@/lib/actions/transform-agents/update-transform-agent";
import { uploadRunInput } from "@/lib/actions/transform-runs/upload-run-input";
import { createTransformRun } from "@/lib/actions/transform-runs/create-transform-run";
import { listTransformRuns } from "@/lib/actions/transform-runs/list-transform-runs";
import { deleteTransformAgent } from "@/lib/actions/transform-agents/delete-transform-agent";
import { TransformRunCard } from "@/components/workflows/sheet-flow/transform-run-card";
import { TransformStepCard } from "@/components/workflows/sheet-flow/transform-step-card";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { ModelSelector } from "@/components/shared/model-selector";
import { transformAgentRowToStore } from "@/lib/store/mappers/transform-agent";
import type { TransformStep } from "@/types/transform-agent";
import { ToolPickerList } from "@/components/chat/tool-picker-list";
import { KnowledgeBasePicker } from "@/components/shared/knowledge-base-picker";
import type { TransformRunRow } from "@/types/transform-run-row";
import { useApiError } from "@/hooks/use-api-error";
import { useKnowledgebases } from "@/hooks/use-knowledgebases";
import { listKnowledgebases } from "@/lib/actions/knowledgebases/list-knowledgebases";
import type { KnowledgebaseWithCount } from "@/lib/actions/knowledgebases/list-knowledgebases";
import { useUserModels } from "@/hooks/use-user-models";

export default function AgentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { handleApiError } = useApiError();
  const id = params.id as string;
  const isNew = id === "new";

  const { mcpServers, loadMcpServers } = useAppStore();
  const { normalizedKnowledgebases: knowledgebases } = useKnowledgebases();
  const { models: chatModels } = useUserModels("chat");

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
  const [activeTab, setActiveTab] = useTabState("tab", "steps");

  // Run dialog state
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runFiles, setRunFiles] = useState<File[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [isStartingRun, setIsStartingRun] = useState(false);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (mcpServers.length === 0) {
      loadMcpServers();
    }
  }, [mcpServers.length, loadMcpServers]);

  useEffect(() => {
    if (chatModels.length === 0) return;
    setModelId((current) => {
      if (current && chatModels.some((model) => model.modelId === current)) {
        return current;
      }
      return chatModels[0].modelId;
    });
  }, [chatModels]);

  useEffect(() => {
    if (isNew) return;
    getTransformAgent(id)
      .then((row) => {
        if (!row) {
          toast.error("Agent not found");
          router.push(ROUTES.WORKFLOWS.TRANSFORM.path);
          return;
        }
        const agent = transformAgentRowToStore(row);
        setName(agent.name);
        setDescription(agent.description);
        setGlobalContext(agent.globalContext ?? "");
        setModelId(agent.modelId ?? chatModels[0]?.modelId ?? "");
        setTools(new Set(agent.tools ?? []));
        setKnowledgeBaseIds(new Set(agent.knowledgeBaseIds ?? []));
        setRequiresFileUpload(agent.requiresFileUpload ?? true);
        setSteps(agent.steps);
      })
      .finally(() => setIsLoading(false));
  }, [chatModels, id, isNew, router]);

  useEffect(() => {
    if (isNew || activeTab !== "runs") return;
    setIsLoadingRuns(true);
    listTransformRuns(id)
      .then(setRuns)
      .finally(() => setIsLoadingRuns(false));
  }, [id, isNew, activeTab]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    setIsSaving(true);
    try {
      if (isNew) {
        const row = await createTransformAgent({
          name,
          description,
          globalContext,
          modelId,
          tools: Array.from(tools),
          knowledgeBaseIds: Array.from(knowledgeBaseIds),
          requiresFileUpload,
          steps,
        });
        toast.success("Agent created");
        router.push(ROUTES.WORKFLOWS.TRANSFORM.detail(row.id));
      } else {
        await updateTransformAgent(id, {
          name,
          description,
          globalContext,
          modelId,
          tools: Array.from(tools),
          knowledgeBaseIds: Array.from(knowledgeBaseIds),
          requiresFileUpload,
          steps,
        });
        toast.success("Agent saved");
      }
    } catch {
      toast.error("Failed to save agent");
    } finally {
      setIsSaving(false);
    }
  };

  const addStep = () => {
    const newStep: TransformStep = {
      id: crypto.randomUUID(),
      name: "New Step",
      prompt: "",
      mcpServerIds: [],
      toolIds: [],
      order: steps.length,
      requiresReview: false,
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (index: number, updates: Partial<TransformStep>) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], ...updates };
    setSteps(updated);
  };

  const removeStep = (index: number) => {
    const updated = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, order: i }));
    setSteps(updated);
  };

  const toggleTool = (serverId: string, toolName: string) => {
    const toolId = `${serverId}:tool:${toolName}`;
    setTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
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

  const handleStartRun = async () => {
    if (requiresFileUpload && runFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }
    setIsStartingRun(true);
    try {
      const formData = new FormData();
      runFiles.forEach((f) => formData.append("files", f));
      const uploaded = await uploadRunInput(formData);

      if (isNew) {
        toast.error("Save the agent before running");
        return;
      }
      const run = await createTransformRun({
        agentId: id,
        inputAttachmentIds: uploaded.map((u) => u.id),
        dryRun,
      });

      setRunDialogOpen(false);
      router.push(ROUTES.WORKFLOWS.TRANSFORM.runs(id, run.id));
    } catch (error: any) {
      if (!handleApiError(error)) {
        toast.error(error?.message || "Failed to start run");
      }
    } finally {
      setIsStartingRun(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteTransformAgent(id);
      toast.success("Agent deleted");
      router.push(ROUTES.WORKFLOWS.TRANSFORM.path);
    } catch {
      toast.error("Failed to delete agent");
    } finally {
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
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <PageHeader
          icon={<Zap className="h-8 w-8 text-amber-500" />}
          title={isNew ? "New Transform Agent" : `Edit: ${name}`}
          description="Define the steps for your automated transformation."
        />
        <div className="ml-auto flex gap-2">
          {!isNew && (
            <Dialog open={runDialogOpen} onOpenChange={setRunDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Play className="mr-2 h-4 w-4" /> Run
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Start New Run</DialogTitle>
                  <DialogDescription>
                    Upload Excel files to transform and configure run options.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  {requiresFileUpload && (
                    <div className="space-y-2">
                      <Label>Input Files</Label>
                      <input
                        type="file"
                        multiple
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) =>
                          setRunFiles(Array.from(e.target.files ?? []))
                        }
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:cursor-pointer"
                      />
                      {runFiles.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {runFiles.length} file
                          {runFiles.length !== 1 ? "s" : ""} selected
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Dry Run Mode</Label>
                      <p className="text-xs text-muted-foreground">
                        Execute without saving output files.
                      </p>
                    </div>
                    <Switch checked={dryRun} onCheckedChange={setDryRun} />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setRunDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleStartRun}
                    disabled={
                      isStartingRun ||
                      (requiresFileUpload && runFiles.length === 0)
                    }
                  >
                    {isStartingRun ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Start Run
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Agent
          </Button>
        </div>
      </div>

      <SidebarTabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <SidebarTabsList>
          <SidebarTabsTrigger value="steps">
            <List className="mr-2 h-4 w-4" />
            <span>Steps</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="prompt">
            <Edit2 className="mr-2 h-4 w-4" />
            <span>Prompt</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="knowledge">
            <Database className="mr-2 h-4 w-4" />
            <span>Knowledge</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="tools">
            <Zap className="mr-2 h-4 w-4" />
            <span>Tools</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="config">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </SidebarTabsTrigger>
          {!isNew && (
            <SidebarTabsTrigger value="runs">
              <History className="mr-2 h-4 w-4" />
              <span>Runs</span>
            </SidebarTabsTrigger>
          )}
          {!isNew && (
            <SidebarTabsTrigger value="danger">
              <Shield className="mr-2 h-4 w-4" />
              <span>Danger Zone</span>
            </SidebarTabsTrigger>
          )}
        </SidebarTabsList>

        <SidebarTabsContent value="steps" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Steps</h3>
            <Button size="sm" variant="outline" onClick={addStep}>
              <Plus className="mr-2 h-4 w-4" /> Add Step
            </Button>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <TransformStepCard
                key={step.id}
                step={step}
                index={index}
                onUpdate={(updates) => updateStep(index, updates)}
                onRemove={() => removeStep(index)}
              />
            ))}

            {steps.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                <p>No steps defined for this agent.</p>
                <Button variant="link" onClick={addStep}>
                  Add your first step
                </Button>
              </div>
            )}
          </div>
        </SidebarTabsContent>

        <SidebarTabsContent value="prompt" className="space-y-8">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Global Context</h3>
            <p className="text-sm text-muted-foreground">
              Provide background information that applies to all steps in this
              transformation.
            </p>
          </div>

          <div className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="globalContext">Background Context</Label>
              <Textarea
                id="globalContext"
                value={globalContext}
                onChange={(e) => setGlobalContext(e.target.value)}
                placeholder="e.g. This agent handles monthly financial reports. All currency values should be in USD..."
                rows={10}
              />
            </div>
          </div>
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
            <KnowledgeBasePicker
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
          <SidebarTabsContent value="runs" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Run History</h3>
              <p className="text-sm text-muted-foreground">
                History of transformations executed by this agent.
              </p>
            </div>
            {isLoadingRuns ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : runs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center text-muted-foreground">
                <p>No runs yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {runs.map((run) => (
                  <TransformRunCard key={run.id} run={run} agentId={id} />
                ))}
              </div>
            )}
          </SidebarTabsContent>
        )}

        <SidebarTabsContent value="config" className="space-y-8">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">Agent Details</h3>
            <p className="text-sm text-muted-foreground">
              Basic configuration and metadata for this transform agent.
            </p>
          </div>

          <div className="space-y-6 max-w-2xl">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly Expense Report"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this agent do?"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <ModelSelector
                value={modelId}
                onValueChange={setModelId}
                className="w-full border bg-card h-10 px-3"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Require File Upload</Label>
                <p className="text-sm text-muted-foreground">
                  If enabled, users will be prompted to upload spreadsheet files
                  before running the agent.
                </p>
              </div>
              <Switch
                checked={requiresFileUpload}
                onCheckedChange={setRequiresFileUpload}
              />
            </div>
          </div>
        </SidebarTabsContent>

        {!isNew && (
          <SidebarTabsContent value="danger">
            <Card className="border-destructive/50">
              <CardHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-destructive">
                    Danger Zone
                  </CardTitle>
                </div>
                <CardDescription>
                  Irreversible actions for this transform agent.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Deleting this agent will permanently remove its configuration
                  and steps. Past runs will be preserved but dissociated. This
                  action cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete Agent
                </Button>
              </CardContent>
            </Card>
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
