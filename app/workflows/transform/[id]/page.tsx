"use client";

import { PageHeader } from "@/components/page-header";
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
import { ROUTES } from "@/constants/routes";
import { MOCK_AGENTS } from "@/lib/mocks/transform-data";
import { ArrowLeft, Plus, Save, Trash2, GripVertical, CheckCircle2, Clock, Zap } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

export default function AgentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const existingAgent = MOCK_AGENTS.find((a) => a.id === id);
  
  const [name, setName] = useState(existingAgent?.name || "");
  const [description, setDescription] = useState(existingAgent?.description || "");
  const [steps, setSteps] = useState(existingAgent?.steps || []);

  const handleSave = () => {
    // In a real app, this would call a server action
    router.push(ROUTES.WORKFLOWS.TRANSFORM.path);
  };

  const addStep = () => {
    const newStep = {
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
          title={id === "new" ? "New Transform Agent" : `Edit: ${name}`}
          description="Define the steps for your automated transformation."
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            Save Agent
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent Details</CardTitle>
              <CardDescription>
                Basic information about this agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Run Settings</CardTitle>
              <CardDescription>
                Configure how this agent executes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>AI Model</Label>
                <Badge variant="secondary" className="w-full justify-start py-2 px-3 text-sm font-normal">
                  gpt-4o (Default)
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dry Run Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Don&apos;t persist output files by default.
                  </p>
                </div>
                <Switch disabled />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Steps</h3>
            <Button size="sm" variant="outline" onClick={addStep}>
              <Plus className="mr-2 h-4 w-4" />
              Add Step
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
                  <div className="flex-1 space-y-1">
                    <Input
                      value={step.name}
                      onChange={(e) => {
                        const newSteps = [...steps];
                        newSteps[index].name = e.target.value;
                        setSteps(newSteps);
                      }}
                      className="h-8 font-semibold border-none focus-visible:ring-0 px-0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="py-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">AI Prompt</Label>
                    <Textarea
                      value={step.prompt}
                      onChange={(e) => {
                        const newSteps = [...steps];
                        newSteps[index].prompt = e.target.value;
                        setSteps(newSteps);
                      }}
                      placeholder="Instruct the AI on what to do in this step..."
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">MCP Servers</Label>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">excel-mcp</Badge>
                        <Button variant="ghost" size="icon" className="h-5 w-5 rounded-full">
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Human Review</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={step.requiresReview}
                          onCheckedChange={(checked) => {
                            const newSteps = [...steps];
                            newSteps[index].requiresReview = checked;
                            setSteps(newSteps);
                          }}
                        />
                        <span className="text-sm text-muted-foreground">
                          {step.requiresReview ? "Required" : "Skipped"}
                        </span>
                      </div>
                    </div>
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
        </div>
      </div>
    </div>
  );
}
