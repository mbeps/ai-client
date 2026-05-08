"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
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
  GripVertical,
  Zap,
  Play,
  Loader2,
  Settings,
  List,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
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
import { transformAgentRowToStore } from "@/lib/store/mappers/transform-agent";
import type { TransformStep } from "@/types/transform-agent";
import { DEFAULT_MODEL, MODELS } from "@/constants/models";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AgentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const isNew = id === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL);
  const [steps, setSteps] = useState<TransformStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(!isNew);

  // Run dialog state
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runFiles, setRunFiles] = useState<File[]>([]);
  const [dryRun, setDryRun] = useState(false);
  const [isStartingRun, setIsStartingRun] = useState(false);

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
        setModelId(agent.modelId ?? DEFAULT_MODEL);
        setSteps(agent.steps);
      })
      .finally(() => setIsLoading(false));
  }, [id, isNew, router]);

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
          modelId,
          steps,
        });
        toast.success("Agent created");
        router.push(ROUTES.WORKFLOWS.TRANSFORM.detail(row.id));
      } else {
        await updateTransformAgent(id, { name, description, modelId, steps });
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

  const handleStartRun = async () => {
    if (runFiles.length === 0) {
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
      router.push(ROUTES.WORKFLOWS.TRANSFORM.runs(run.id));
    } catch {
      toast.error("Failed to start run");
    } finally {
      setIsStartingRun(false);
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
        <Button variant="ghost" size="icon" asChild>
          <Link href={ROUTES.WORKFLOWS.TRANSFORM.path}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
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
                        {runFiles.length} file{runFiles.length !== 1 ? "s" : ""}{" "}
                        selected
                      </p>
                    )}
                  </div>
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
                    disabled={isStartingRun || runFiles.length === 0}
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

      <SidebarTabs defaultValue="steps" className="w-full">
        <SidebarTabsList>
          <SidebarTabsTrigger value="steps">
            <List className="mr-2 h-4 w-4" />
            <span>Steps</span>
          </SidebarTabsTrigger>
          <SidebarTabsTrigger value="config">
            <Settings className="mr-2 h-4 w-4" />
            <span>Configuration</span>
          </SidebarTabsTrigger>
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
              <Card key={step.id} className="relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                <CardHeader className="py-4 flex flex-row items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <Input
                      value={step.name}
                      onChange={(e) =>
                        updateStep(index, { name: e.target.value })
                      }
                      className="h-8 font-semibold border-none focus-visible:ring-0 px-0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeStep(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      AI Prompt
                    </Label>
                    <Textarea
                      value={step.prompt}
                      onChange={(e) =>
                        updateStep(index, { prompt: e.target.value })
                      }
                      placeholder="Instruct the AI on what to do in this step..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      Context (optional)
                    </Label>
                    <Textarea
                      value={step.context ?? ""}
                      onChange={(e) =>
                        updateStep(index, {
                          context: e.target.value || undefined,
                        })
                      }
                      placeholder="Optional background context for the AI..."
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                        Human Review
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Pause pipeline after this step for review.
                      </p>
                    </div>
                    <Switch
                      checked={step.requiresReview}
                      onCheckedChange={(checked) =>
                        updateStep(index, { requiresReview: checked })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
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
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger id="model">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SidebarTabsContent>
      </SidebarTabs>
    </div>
  );
}
