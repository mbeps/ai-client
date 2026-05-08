"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Play,
  AlertCircle,
  Loader2,
  ThumbsUp,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getTransformRun } from "@/lib/actions/transform-runs/get-transform-run";
import { getAttachmentUrl } from "@/lib/actions/attachments/get-attachment-url";
import { getTransformAgent } from "@/lib/actions/transform-agents/get-transform-agent";
import { transformAgentRowToStore } from "@/lib/store/mappers/transform-agent";
import type { TransformAgent } from "@/types/transform-agent";
import type { TransformRun, TransformRunStatus } from "@/types/transform-run";
import type { TransformRunRow } from "@/types/transform-run-row";

type StepState = {
  status: "pending" | "running" | "completed" | "awaiting_review";
  summary?: string;
};

function mapRunRowToRun(row: TransformRunRow): TransformRun {
  return {
    id: row.id,
    agentId: row.agentId,
    userId: row.userId,
    status: row.status as TransformRunStatus,
    currentStepIndex: row.currentStepIndex ?? null,
    dryRun: row.dryRun,
    inputAttachmentIds: JSON.parse(row.inputAttachmentIds || "[]"),
    outputAttachmentIds: JSON.parse(row.outputAttachmentIds || "[]"),
    errorMessage: row.errorMessage ?? "",
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export default function TransformRunDetailPage() {
  const params = useParams();
  const agentId = params.id as string;
  const runId = params.runId as string;

  const [run, setRun] = useState<TransformRun | null>(null);
  const [agent, setAgent] = useState<TransformAgent | null>(null);
  const [stepStates, setStepStates] = useState<Record<number, StepState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [attachmentMeta, setAttachmentMeta] = useState<
    Record<string, { url: string; name: string }>
  >({});
  const hasStartedStream = useRef(false);

  useEffect(() => {
    async function load() {
      const runRow = await getTransformRun(runId);
      if (!runRow) {
        setIsLoading(false);
        return;
      }
      const mapped = mapRunRowToRun(runRow);
      setRun(mapped);

      const agentRow = await getTransformAgent(runRow.agentId);
      if (agentRow) {
        setAgent(transformAgentRowToStore(agentRow));
      }
      setIsLoading(false);

      // Initialize step states from DB
      const initial: Record<number, StepState> = {};
      const steps = agentRow ? JSON.parse(agentRow.steps || "[]") : [];
      steps.forEach((_: unknown, i: number) => {
        if (mapped.status === "completed") {
          initial[i] = { status: "completed" };
        } else if (
          mapped.currentStepIndex !== null &&
          i < mapped.currentStepIndex
        ) {
          initial[i] = { status: "completed" };
        } else if (
          mapped.status === "awaiting_review" &&
          i === mapped.currentStepIndex
        ) {
          initial[i] = { status: "awaiting_review" };
        } else {
          initial[i] = { status: "pending" };
        }
      });
      setStepStates(initial);

      // Fetch presigned URLs for all attachment IDs
      const allIds = [
        ...mapped.inputAttachmentIds,
        ...mapped.outputAttachmentIds,
      ];
      if (allIds.length > 0) {
        const results = await Promise.allSettled(
          allIds.map((id) => getAttachmentUrl(id)),
        );
        const meta: Record<string, { url: string; name: string }> = {};
        results.forEach((r, i) => {
          if (r.status === "fulfilled")
            meta[allIds[i]] = { url: r.value.url, name: r.value.name };
        });
        setAttachmentMeta(meta);
      }
    }
    load();
  }, [runId]);

  useEffect(() => {
    if (!run || !agent || hasStartedStream.current) return;
    if (run.status !== "pending" && run.status !== "running") return;

    hasStartedStream.current = true;
    startStream({ type: "start", runId: run.id });
  }, [run, agent]);

  function startStream(body: object) {
    fetch("/api/transform/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        function read() {
          reader
            .read()
            .then(({ done, value }) => {
              if (done) return;
              const text = decoder.decode(value, { stream: true });
              const lines = text.split("\n");
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                try {
                  const event = JSON.parse(line.slice(6));
                  handleSseEvent(event);
                } catch {
                  // skip malformed events
                }
              }
              read();
            })
            .catch(() => {
              setStreamError("Connection error");
            });
        }
        read();
      })
      .catch(() => {
        setStreamError("Failed to connect to run engine");
      });
  }

  function handleSseEvent(event: Record<string, unknown>) {
    switch (event.type) {
      case "transform-start":
        setRun((prev) => (prev ? { ...prev, status: "running" } : prev));
        break;

      case "transform-step-start":
        setStepStates((prev) => ({
          ...prev,
          [event.stepIndex as number]: { status: "running" },
        }));
        setRun((prev) =>
          prev
            ? { ...prev, currentStepIndex: event.stepIndex as number }
            : prev,
        );
        break;

      case "transform-step-complete":
        setStepStates((prev) => ({
          ...prev,
          [event.stepIndex as number]: {
            status: "completed",
            summary: event.summary as string,
          },
        }));
        break;

      case "transform-review-required":
        setStepStates((prev) => ({
          ...prev,
          [event.stepIndex as number]: {
            ...prev[event.stepIndex as number],
            status: "awaiting_review",
          },
        }));
        setRun((prev) =>
          prev
            ? {
                ...prev,
                status: "awaiting_review",
                currentStepIndex: event.stepIndex as number,
              }
            : prev,
        );
        break;

      case "transform-complete": {
        const outputIds = (event.outputAttachmentIds as string[]) ?? [];
        setRun((prev) =>
          prev
            ? {
                ...prev,
                status: "completed",
                outputAttachmentIds: outputIds,
              }
            : prev,
        );
        toast.success("Transformation complete");
        if (outputIds.length > 0) {
          Promise.allSettled(outputIds.map((id) => getAttachmentUrl(id))).then(
            (results) => {
              setAttachmentMeta((prev) => {
                const next = { ...prev };
                results.forEach((r, i) => {
                  if (r.status === "fulfilled")
                    next[outputIds[i]] = {
                      url: r.value.url,
                      name: r.value.name,
                    };
                });
                return next;
              });
            },
          );
        }
        break;
      }

      case "error":
        setStreamError(event.message as string);
        setRun((prev) => (prev ? { ...prev, status: "failed" } : prev));
        toast.error(event.message as string);
        break;
    }
  }

  const handleApprove = async () => {
    if (!run) return;
    setIsApproving(true);
    try {
      hasStartedStream.current = false;
      startStream({ type: "resume", runId: run.id });
      hasStartedStream.current = true;
    } catch {
      toast.error("Failed to approve run");
    } finally {
      setIsApproving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

  const statusColors: Record<string, string> = {
    completed: "bg-green-500",
    running: "bg-blue-500",
    failed: "bg-red-500",
    pending: "bg-gray-500",
    awaiting_review: "bg-amber-500",
  };

  const completedSteps = Object.values(stepStates).filter(
    (s) => s.status === "completed",
  ).length;
  const progress =
    run.status === "completed"
      ? 100
      : agent.steps.length > 0
        ? (completedSteps / agent.steps.length) * 100
        : 0;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={ROUTES.WORKFLOWS.TRANSFORM.detail(agentId)}>
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
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleApprove}
              disabled={isApproving}
            >
              {isApproving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ThumbsUp className="mr-2 h-4 w-4" />
              )}
              Approve &amp; Continue
            </Button>
          )}
        </div>
      </div>

      {streamError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {streamError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Run Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${statusColors[run.status] ?? "bg-gray-500"}`}
                />
                <span className="font-semibold capitalize">
                  {run.status.replace("_", " ")}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground font-medium">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
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
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Input
                </p>
                {run.inputAttachmentIds.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No input files
                  </p>
                ) : (
                  run.inputAttachmentIds.map((fileId) => (
                    <a
                      key={fileId}
                      href={attachmentMeta[fileId]?.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-md border p-2 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-xs truncate font-medium">
                        {attachmentMeta[fileId]?.name ??
                          `${fileId.slice(0, 8)}…`}
                      </span>
                      <Download className="h-3 w-3 text-muted-foreground" />
                    </a>
                  ))
                )}
              </div>
              {run.outputAttachmentIds.length > 0 && (
                <div className="space-y-2">
                  <Separator />
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Output
                  </p>
                  {run.outputAttachmentIds.map((fileId) => (
                    <a
                      key={fileId}
                      href={attachmentMeta[fileId]?.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 p-2 hover:bg-primary/10 transition-colors"
                    >
                      <span className="text-xs truncate font-medium">
                        {attachmentMeta[fileId]?.name ??
                          `${fileId.slice(0, 8)}…`}
                      </span>
                      <Download className="h-3 w-3 text-primary" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3 space-y-4">
          <h3 className="text-lg font-semibold">Execution Timeline</h3>
          <div className="space-y-0 relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-[1px] before:bg-muted">
            {agent.steps.map((step, index) => {
              const state = stepStates[index] ?? { status: "pending" };
              const isCompleted = state.status === "completed";
              const isCurrent = state.status === "running";
              const isAwaiting = state.status === "awaiting_review";

              return (
                <div key={step.id} className="relative pl-10 pb-8 last:pb-0">
                  <div
                    className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border bg-background z-10 ${
                      isCompleted
                        ? "border-green-500 text-green-500"
                        : isCurrent
                          ? "border-blue-500 text-blue-500 animate-pulse"
                          : isAwaiting
                            ? "border-amber-500 text-amber-500"
                            : "text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isAwaiting ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <Circle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`font-semibold ${isCurrent || isAwaiting ? "text-primary" : ""}`}
                      >
                        {step.name}
                      </h4>
                      {isCompleted && (
                        <Badge
                          variant="secondary"
                          className="h-5 bg-green-50 text-green-700 border-green-200"
                        >
                          Completed
                        </Badge>
                      )}
                      {isAwaiting && (
                        <Badge
                          variant="secondary"
                          className="h-5 bg-amber-50 text-amber-700 border-amber-200"
                        >
                          Awaiting Review
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isCompleted && state.summary
                        ? state.summary
                        : isCompleted
                          ? "Step completed successfully."
                          : isCurrent
                            ? "Executing AI transformation..."
                            : isAwaiting
                              ? "Transformation complete. Waiting for approval to continue."
                              : "Waiting to execute..."}
                    </p>
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
