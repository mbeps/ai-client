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
import { ROUTES } from "@/constants/routes";
import { MOCK_AGENTS, MOCK_RUNS } from "@/lib/mocks/transform-data";
import { ArrowLeft, CheckCircle2, Circle, Clock, Download, ExternalLink, Play, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export default function TransformRunDetailPage() {
  const params = useParams();
  const id = params.id as string;
  
  const run = MOCK_RUNS.find((r) => r.id === id);
  const agent = MOCK_AGENTS.find((a) => a.id === run?.agentId);

  if (!run || !agent) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Run not found</h2>
        <Button asChild>
          <Link href={ROUTES.WORKFLOWS.TRANSFORM.path}>Back to Agents</Link>
        </Button>
      </div>
    );
  }

  const statusColors = {
    completed: "bg-green-500",
    running: "bg-blue-500",
    failed: "bg-red-500",
    pending: "bg-gray-500",
    awaiting_review: "bg-amber-500",
  };

  const progress = run.status === "completed" 
    ? 100 
    : run.currentStepIndex !== null 
      ? ((run.currentStepIndex + 1) / agent.steps.length) * 100 
      : 0;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={ROUTES.WORKFLOWS.TRANSFORM.path}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          icon={<Play className="h-8 w-8 text-blue-500" />}
          title={`Run: ${agent.name}`}
          description={`Started on ${run.createdAt.toLocaleString()}`}
        />
        <div className="ml-auto flex gap-2">
          {run.status === "awaiting_review" && (
            <Button className="bg-amber-600 hover:bg-amber-700">
              Approve Step
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href={ROUTES.WORKFLOWS.TRANSFORM.detail(agent.id)}>
              <Play className="mr-2 h-4 w-4" />
              Re-run
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Run Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${statusColors[run.status]}`} />
                <span className="font-semibold capitalize">{run.status.replace("_", " ")}</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Execution Time</p>
                <p className="text-sm font-medium">1m 32s</p>
              </div>
              {run.dryRun && (
                <Badge variant="outline" className="w-full justify-center py-1">
                  Dry Run Mode
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Input</p>
                {run.inputAttachmentIds.map((fileId) => (
                  <div key={fileId} className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-xs truncate font-medium">source_data.xlsx</span>
                    <Download className="h-3 w-3 text-muted-foreground" />
                  </div>
                ))}
              </div>
              {run.outputAttachmentIds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Output</p>
                  {run.outputAttachmentIds.map((fileId) => (
                    <div key={fileId} className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 p-2">
                      <span className="text-xs truncate font-medium">transformed_data.xlsx</span>
                      <Download className="h-3 w-3 text-primary" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-lg font-semibold">Execution Timeline</h3>
          <div className="space-y-0 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-[1px] before:bg-muted">
            {agent.steps.map((step, index) => {
              const isCompleted = run.status === "completed" || (run.currentStepIndex !== null && index < run.currentStepIndex);
              const isCurrent = run.status === "running" && index === run.currentStepIndex;
              const isAwaiting = run.status === "awaiting_review" && index === run.currentStepIndex;
              
              return (
                <div key={step.id} className="relative pl-10 pb-8 last:pb-0">
                  <div className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border bg-background z-10 
                    ${isCompleted ? "border-green-500 text-green-500" : isCurrent ? "border-blue-500 text-blue-500 animate-pulse" : isAwaiting ? "border-amber-500 text-amber-500" : "text-muted-foreground"}`}
                  >
                    {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : isCurrent ? <Play className="h-4 w-4 fill-current" /> : isAwaiting ? <Clock className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-semibold ${isCurrent || isAwaiting ? "text-primary" : ""}`}>
                        {step.name}
                      </h4>
                      {isCompleted && <Badge variant="secondary" className="h-5 bg-green-50 text-green-700 border-green-200">Completed</Badge>}
                      {isAwaiting && <Badge variant="secondary" className="h-5 bg-amber-50 text-amber-700 border-amber-200">Awaiting Review</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isCompleted 
                        ? "Successfully processed transformation rules and saved results." 
                        : isCurrent 
                          ? "Executing AI transformation with restricted toolset..." 
                          : isAwaiting 
                            ? "Transformation complete. Waiting for user sign-off." 
                            : "Waiting to execute..."}
                    </p>
                    
                    {isCompleted && (
                      <div className="mt-2 text-xs flex gap-4">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" /> 12.4s
                        </span>
                        <span className="flex items-center gap-1 text-primary cursor-pointer hover:underline">
                          <ExternalLink className="h-3 w-3" /> View tool calls
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
