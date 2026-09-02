"use client";

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  Download,
  Loader2,
  Play,
  ThumbsUp,
} from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { ToolCallDisplay } from "@/components/chat/message/tool-call-display";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { useApiError } from "@/hooks/use-api-error";
import { getAttachmentUrl } from "@/lib/actions/attachments/get-attachment-url";
import { getTransformAgent } from "@/lib/actions/transform-agents/get-transform-agent";
import { getTransformRun } from "@/lib/actions/transform-runs/get-transform-run";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { TransformAgent } from "@/types/transform/transform-agent";
import type { TransformRun } from "@/types/transform/transform-run";
import type { TransformRunRow } from "@/types/transform/transform-run-row";
import type { TransformRunStatus } from "@/types/transform/transform-run-status";

type ToolCall = {
  toolCallId: string;
  toolName: string;
  serverName?: string;
  args: unknown;
};

type ToolResult = {
  toolCallId: string;
  toolName: string;
  serverName?: string;
  result: unknown;
};

type StepState = {
  status: "pending" | "running" | "completed" | "awaiting_review";
  summary?: string;
  stepData?: Record<string, any[]>;
  artifact?: ArtifactData | null;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
};

function mapRunRowToRun(row: TransformRunRow): TransformRun {
  return {
    id: row.id,
    agentId: row.agentId,
    userId: row.userId,
    status: row.status as TransformRunStatus,
    currentStepIndex: row.currentStepIndex ?? null,
    dryRun: row.dryRun,
    inputAttachmentIds: row.inputAttachmentIds,
    outputAttachmentIds: row.outputAttachmentIds,
    errorMessage: row.errorMessage ?? "",
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

/**
 * Transform run detail page showing real-time execution progress and results.
 * Client component displaying execution timeline, step status, tool calls, and artifacts.
 * Handles Server-Sent Events stream for live status updates and progress tracking.
 * Supports approval gates for review-required steps and artifact panel for viewing intermediate/final outputs.
 * Integrates with artifact download and attachment URL resolution.
 *
 * @author Maruf Bepary
 */
export default function TransformRunDetailPage() {
  const params = useParams();
  const _router = useRouter();
  const { handleApiError } = useApiError();
  const _agentId = params.id as string;
  const runId = params.runId as string;

  const [run, setRun] = useState<TransformRun | null>(null);
  const [agent, setAgent] = useState<TransformAgent | null>(null);
  const [stepStates, setStepStates] = useState<Record<number, StepState>>({});
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(
    null,
  );
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [attachmentMeta, setAttachmentMeta] = useState<
    Record<string, { url: string; name: string }>
  >({});
  const [isMobile, setIsMobile] = useState(false);
  const hasStartedStream = useRef(false);
  const activeStepIndexRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
        let steps = [];
        try {
          steps = JSON.parse(agentRow.steps);
        } catch {
          steps = [];
        }
        setAgent({
          id: agentRow.id,
          userId: agentRow.userId,
          name: agentRow.name,
          description: agentRow.description ?? "",
          globalContext: agentRow.globalContext ?? undefined,
          modelId: agentRow.modelId ?? undefined,
          tools: agentRow.tools,
          knowledgeBaseIds: agentRow.knowledgeBaseIds,
          requiresFileUpload: agentRow.requiresFileUpload,
          steps,
          createdAt: new Date(agentRow.createdAt),
          updatedAt: new Date(agentRow.updatedAt),
        });
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

  const handleSseEvent = useCallback(
    (event: Record<string, unknown>) => {
      switch (event.type) {
        case "transform-start":
          setRun((prev: TransformRun | null) =>
            prev ? { ...prev, status: "running" } : prev,
          );
          break;

        case "transform-step-start": {
          const stepIndex = event.stepIndex as number;
          activeStepIndexRef.current = stepIndex;
          setStepStates((prev: Record<number, StepState>) => {
            const updated = { ...prev };
            // Mark any previous step indices as completed so reviewed steps do not stay in awaiting_review
            for (let i = 0; i < stepIndex; i++) {
              if (updated[i]) {
                updated[i] = { ...updated[i], status: "completed" };
              }
            }
            updated[stepIndex] = {
              status: "running",
              toolCalls: [],
              toolResults: [],
            };
            return updated;
          });
          setRun((prev: TransformRun | null) =>
            prev ? { ...prev, currentStepIndex: stepIndex } : prev,
          );
          break;
        }

        case "tool-call":
          if (activeStepIndexRef.current !== null) {
            const stepIdx = activeStepIndexRef.current;
            setStepStates((prev: Record<number, StepState>) => {
              const current = prev[stepIdx] || { status: "running" };
              return {
                ...prev,
                [stepIdx]: {
                  ...current,
                  toolCalls: [
                    ...(current.toolCalls || []),
                    {
                      toolCallId: event.toolCallId as string,
                      toolName: event.toolName as string,
                      args: event.args,
                      serverName: event.serverName as string,
                    },
                  ],
                },
              };
            });
          }
          break;

        case "tool-result":
          if (activeStepIndexRef.current !== null) {
            const stepIdx = activeStepIndexRef.current;
            setStepStates((prev: Record<number, StepState>) => {
              const current = prev[stepIdx] || { status: "running" };
              return {
                ...prev,
                [stepIdx]: {
                  ...current,
                  toolResults: [
                    ...(current.toolResults || []),
                    {
                      toolCallId: event.toolCallId as string,
                      toolName: event.toolName as string,
                      result: event.result,
                      serverName: event.serverName as string,
                    },
                  ],
                },
              };
            });
          }
          break;

        case "transform-step-complete":
          setStepStates((prev: Record<number, StepState>) => ({
            ...prev,
            [event.stepIndex as number]: {
              ...prev[event.stepIndex as number],
              status: "completed",
              summary: event.summary as string,
              stepData: event.stepData as Record<string, any[]>,
              artifact: (event.artifact as ArtifactData | null) ?? null,
            },
          }));
          setSelectedStepIndex(event.stepIndex as number);
          if (event.artifact) setIsArtifactOpen(true);
          break;

        case "transform-review-required":
          setStepStates((prev: Record<number, StepState>) => ({
            ...prev,
            [event.stepIndex as number]: {
              ...prev[event.stepIndex as number],
              status: "awaiting_review",
            },
          }));
          setRun((prev: TransformRun | null) =>
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
          setRun((prev: TransformRun | null) =>
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
            Promise.allSettled(
              outputIds.map((id) => getAttachmentUrl(id)),
            ).then((results) => {
              setAttachmentMeta(
                (prev: Record<string, { url: string; name: string }>) => {
                  const next = { ...prev };
                  results.forEach((r, i) => {
                    if (r.status === "fulfilled")
                      next[outputIds[i]] = {
                        url: r.value.url,
                        name: r.value.name,
                      };
                  });
                  return next;
                },
              );
            });
          }
          break;
        }

        case "error":
          setStreamError(event.message as string);
          setRun((prev: TransformRun | null) =>
            prev ? { ...prev, status: "failed" } : prev,
          );

          if (!handleApiError(event)) {
            toast.error(event.message as string);
          }
          break;
      }
    },
    [handleApiError],
  );

  const startStream = useCallback(
    (body: object) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      fetch("/api/transform/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      })
        .then((res) => {
          if (!res.body) return;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();

          function read() {
            if (signal.aborted) {
              reader.cancel().catch(() => {});
              return;
            }
            reader
              .read()
              .then(({ done, value }) => {
                if (done || signal.aborted) return;
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
                if (signal.aborted) return;
                setStreamError("Connection error");
              });
          }
          read();
        })
        .catch(() => {
          if (signal.aborted) return;
          setStreamError("Failed to connect to run engine");
        });
    },
    [handleSseEvent],
  );

  useEffect(() => {
    if (!run || !agent || hasStartedStream.current) return;
    if (run.status !== "pending") return;

    hasStartedStream.current = true;
    startStream({ type: "start", runId: run.id });
  }, [run, agent, startStream]);

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

  const currentArtifact = useMemo(() => {
    if (selectedStepIndex === null) return null;
    const stepState = stepStates[selectedStepIndex];
    if (!stepState) return null;

    // Direct artifact from manage_artifact tool call
    if (stepState.artifact) return stepState.artifact;

    // Legacy: spreadsheet built from stepData
    if (!stepState.stepData || Object.keys(stepState.stepData).length === 0) {
      return null;
    }
    const step = agent?.steps[selectedStepIndex];
    const dataMap = stepState.stepData;
    const filenames = Object.keys(dataMap);
    if (filenames.length === 0) return null;

    const firstFile = filenames[0];
    const data = dataMap[firstFile];

    return {
      type: "spreadsheet" as const,
      title: `${step?.name || "Step"} - ${firstFile}`,
      content: JSON.stringify(data),
      messageId: `step-${selectedStepIndex}`,
    };
  }, [selectedStepIndex, stepStates, agent]);

  const hasAnyArtifact = useMemo(() => {
    return Object.values(stepStates).some(
      (state) =>
        state.artifact != null ||
        (state.stepData && Object.keys(state.stepData).length > 0),
    );
  }, [stepStates]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!run || !agent) {
    notFound();
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
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-4 border-b bg-card/50 p-4 backdrop-blur-sm lg:flex-row lg:items-center lg:gap-6 lg:p-6">
        <div className="flex items-center gap-3">
          <PageHeader
            icon={<Play className="h-6 w-6 text-blue-500 lg:h-8 lg:w-8" />}
            title={`Run: ${agent.name}`}
            description={`Started on ${run.createdAt.toLocaleString()}`}
          />
        </div>

        <div className="no-scrollbar flex items-center gap-4 overflow-x-auto pb-2 lg:ml-auto lg:gap-6 lg:pb-0">
          {/* Compact Status */}
          <div className="flex min-w-fit shrink-0 flex-col gap-0.5">
            <span className="font-bold text-[10px] text-muted-foreground/70 uppercase tracking-wider">
              Status
            </span>
            <Badge
              variant="outline"
              className="flex h-5 items-center gap-1.5 whitespace-nowrap border-primary/20 bg-primary/5 px-2 text-[10px] capitalize"
            >
              <div
                className={`h-1 w-1 rounded-full ${statusColors[run.status] ?? "bg-gray-500"} animate-pulse`}
              />
              {run.status.replace("_", " ")}
            </Badge>
          </div>

          <Separator orientation="vertical" className="hidden h-8 lg:block" />

          {/* Compact Progress */}
          <div className="flex min-w-[120px] shrink-0 flex-col gap-1 lg:min-w-40">
            <span className="font-bold text-[10px] text-muted-foreground/70 uppercase tracking-wider">
              Progress
            </span>
            <div className="flex items-center gap-2 lg:gap-3">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="font-bold text-[10px] tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {run.status === "awaiting_review" && (
              <>
                <Separator
                  orientation="vertical"
                  className="mr-4 hidden h-8 lg:block"
                />
                <Button
                  size="sm"
                  className="bg-amber-600 text-xs shadow-lg hover:bg-amber-700"
                  onClick={handleApprove}
                  disabled={isApproving}
                >
                  {isApproving ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <ThumbsUp className="mr-2 h-3 w-3" />
                  )}
                  Approve
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {streamError && (
        <div className="m-4 flex shrink-0 items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {streamError}
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup orientation={isMobile ? "vertical" : "horizontal"}>
          <ResizablePanel
            defaultSize={isMobile ? 50 : 40}
            minSize={isMobile ? 30 : 30}
            className="bg-muted/5"
          >
            <div className="custom-scrollbar h-full space-y-4 overflow-y-auto p-6">
              {/* Execution Timeline */}
              <div className="space-y-6">
                <h3 className="font-bold text-lg tracking-tight">
                  Execution Timeline
                </h3>
                <div className="relative before:absolute before:top-4 before:bottom-4 before:left-4 before:w-px before:bg-gradient-to-b before:from-muted before:via-muted before:to-transparent">
                  {agent.steps.map((step, index) => {
                    const state = stepStates[index] ?? { status: "pending" };
                    const isCompleted = state.status === "completed";
                    const isCurrent = state.status === "running";
                    const isAwaiting = state.status === "awaiting_review";
                    const isSelected = selectedStepIndex === index;

                    return (
                      <div
                        key={step.id}
                        className={`group relative pb-6 pl-10 transition-all duration-200 last:pb-0 ${
                          isCompleted || isAwaiting
                            ? "cursor-pointer"
                            : "opacity-60"
                        }`}
                        onClick={() => {
                          if (isCompleted || isAwaiting) {
                            setSelectedStepIndex(index);
                            setIsArtifactOpen(true);
                          }
                        }}
                      >
                        <div
                          className={`absolute top-3 left-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border-muted-foreground/10 bg-background shadow-sm transition-all ${
                            isCompleted
                              ? "border border-green-500 bg-green-50/50 text-green-500"
                              : isCurrent
                                ? "animate-pulse border border-blue-500 text-blue-500 ring-4 ring-blue-500/10"
                                : isAwaiting
                                  ? "border border-amber-500 bg-amber-50/50 text-amber-500"
                                  : "border text-muted-foreground"
                          } ${isSelected ? "shadow-md ring-2 ring-primary/20" : ""}`}
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
                        <div
                          className={`rounded-xl border p-4 transition-all ${
                            isSelected
                              ? "translate-x-1 border-primary/20 bg-primary/5 shadow-sm"
                              : "border-transparent bg-transparent hover:bg-muted/30"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <h4
                              className={`font-bold text-sm ${isSelected ? "text-primary" : ""}`}
                            >
                              {step.name}
                            </h4>
                            {isCompleted && (
                              <Badge
                                variant="secondary"
                                className="h-4 border-green-500/20 bg-green-500/10 text-[10px] text-green-700 uppercase tracking-tighter"
                              >
                                Done
                              </Badge>
                            )}
                          </div>

                          {/* Tool Calls */}
                          {state.toolCalls && state.toolCalls.length > 0 && (
                            <div
                              className="mt-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ToolCallDisplay
                                toolCalls={state.toolCalls}
                                toolResults={state.toolResults || []}
                              />
                            </div>
                          )}

                          <p className="line-clamp-2 text-muted-foreground text-xs">
                            {isCompleted && state.summary
                              ? state.summary
                              : isCompleted
                                ? "Step completed successfully."
                                : isCurrent
                                  ? "AI is working on your request..."
                                  : isAwaiting
                                    ? "Waiting for your review..."
                                    : "Scheduled for execution."}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Output Download Section */}
              {run?.status === "completed" &&
                run.outputAttachmentIds.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 font-bold text-muted-foreground/70 text-xs uppercase tracking-widest">
                      <Download className="h-3 w-3" />
                      Final Results
                    </h4>
                    <div className="grid gap-2">
                      {run.outputAttachmentIds.map((id: string) => {
                        const meta = attachmentMeta[id];
                        if (!meta) return null;
                        return (
                          <Card
                            key={id}
                            className="group overflow-hidden border-primary/10 bg-primary/5 py-0.5 transition-colors hover:border-primary/30"
                          >
                            <CardContent className="p-0">
                              <a
                                href={meta.url}
                                download={meta.name}
                                className="flex items-center justify-between p-3 transition-colors hover:bg-primary/5"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="rounded-lg border border-primary/10 bg-background p-2 shadow-sm">
                                    <Download className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <p className="max-w-[200px] truncate font-bold text-sm">
                                      {meta.name}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Ready for download
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </a>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              {/* Storage Notice */}
              <div className="rounded-xl border border-blue-100/50 bg-blue-50/50 p-4 backdrop-blur-sm">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-blue-600" />
                  <div className="space-y-1">
                    <p className="font-semibold text-blue-900 text-sm">
                      Storage Optimization
                    </p>
                    <p className="text-blue-700/80 text-xs leading-relaxed">
                      Intermediate step previews are temporary and stored in
                      memory for the current session. Only the final result is
                      saved to permanent storage.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>

          {(agent.tools?.includes("manage_artifact") ||
            hasAnyArtifact ||
            selectedStepIndex !== null) && (
            <>
              <ResizableHandle withHandle className="hidden lg:flex" />

              <ResizablePanel
                defaultSize={50}
                minSize={30}
                className="hidden bg-card lg:block"
              >
                <div className="relative h-full overflow-hidden">
                  {currentArtifact ? (
                    <ArtifactPanel
                      artifact={currentArtifact}
                      isOpen={isArtifactOpen}
                      onClose={() => setIsArtifactOpen(false)}
                      isFullWidth={true}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-6 bg-muted/5 p-12 text-center text-muted-foreground">
                      <div className="relative">
                        <div className="absolute -inset-4 animate-pulse rounded-full bg-primary/10 blur-2xl" />
                        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border bg-card shadow-xl">
                          <Play className="h-10 w-10 text-primary/40" />
                        </div>
                      </div>
                      <div className="max-w-sm space-y-2">
                        <p className="font-bold text-foreground text-lg">
                          Step Preview
                        </p>
                        <p className="text-muted-foreground/80 text-sm leading-relaxed">
                          {selectedStepIndex !== null
                            ? "This step hasn't produced a preview yet. Pro-tip: select 'manage_artifact' in your agent tools to enable visual updates."
                            : "Select a completed step from the timeline to inspect the output at that stage of the process."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
