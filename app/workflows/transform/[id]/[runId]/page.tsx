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
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ArtifactPanel } from "@/components/chat/artifact-panel";
import { ToolCallDisplay } from "@/components/chat/message/tool-call-display";
import type { ArtifactData } from "@/types/artifact";
import { toast } from "sonner";
import { getTransformRun } from "@/lib/actions/transform-runs/get-transform-run";
import { getAttachmentUrl } from "@/lib/actions/attachments/get-attachment-url";
import { getTransformAgent } from "@/lib/actions/transform-agents/get-transform-agent";
import { transformAgentRowToStore } from "@/lib/store/mappers/transform-agent";
import type { TransformAgent } from "@/types/transform-agent";
import type { TransformRun, TransformRunStatus } from "@/types/transform-run";
import type { TransformRunRow } from "@/types/transform-run-row";
import { useApiError } from "@/hooks/use-api-error";

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

export default function TransformRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { handleApiError } = useApiError();
  const agentId = params.id as string;
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

  const handleSseEvent = useCallback(
    (event: Record<string, unknown>) => {
      switch (event.type) {
        case "transform-start":
          setRun((prev) => (prev ? { ...prev, status: "running" } : prev));
          break;

        case "transform-step-start":
          activeStepIndexRef.current = event.stepIndex as number;
          setStepStates((prev) => ({
            ...prev,
            [event.stepIndex as number]: {
              status: "running",
              toolCalls: [],
              toolResults: [],
            },
          }));
          setRun((prev) =>
            prev
              ? { ...prev, currentStepIndex: event.stepIndex as number }
              : prev,
          );
          break;

        case "tool-call":
          if (activeStepIndexRef.current !== null) {
            const stepIdx = activeStepIndexRef.current;
            setStepStates((prev) => {
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
            setStepStates((prev) => {
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
          setStepStates((prev) => ({
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
            Promise.allSettled(
              outputIds.map((id) => getAttachmentUrl(id)),
            ).then((results) => {
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
            });
          }
          break;
        }

        case "error":
          setStreamError(event.message as string);
          setRun((prev) => (prev ? { ...prev, status: "failed" } : prev));

          if (!handleApiError(event.message)) {
            toast.error(event.message as string);
          }
          break;
      }
    },
    [handleApiError],
  );

  const startStream = useCallback(
    (body: object) => {
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
    },
    [handleSseEvent],
  );

  useEffect(() => {
    if (!run || !agent || hasStartedStream.current) return;
    if (run.status !== "pending" && run.status !== "running") return;

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
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 p-4 lg:p-6 shrink-0 border-b bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <PageHeader
            icon={<Play className="h-6 w-6 lg:h-8 lg:w-8 text-blue-500" />}
            title={`Run: ${agent.name}`}
            description={`Started on ${run.createdAt.toLocaleString()}`}
          />
        </div>

        <div className="flex items-center gap-4 lg:ml-auto lg:gap-6 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
          {/* Compact Status */}
          <div className="flex flex-col gap-0.5 min-w-fit shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Status
            </span>
            <Badge
              variant="outline"
              className="h-5 px-2 text-[10px] border-primary/20 bg-primary/5 capitalize flex items-center gap-1.5 whitespace-nowrap"
            >
              <div
                className={`h-1 w-1 rounded-full ${statusColors[run.status] ?? "bg-gray-500"} animate-pulse`}
              />
              {run.status.replace("_", " ")}
            </Badge>
          </div>

          <Separator orientation="vertical" className="h-8 hidden lg:block" />

          {/* Compact Progress */}
          <div className="flex flex-col gap-1 min-w-[120px] lg:min-w-40 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Progress
            </span>
            <div className="flex items-center gap-2 lg:gap-3">
              <Progress value={progress} className="h-1.5 flex-1" />
              <span className="text-[10px] font-bold tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {run.status === "awaiting_review" && (
              <>
                <Separator
                  orientation="vertical"
                  className="h-8 hidden lg:block mr-4"
                />
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 shadow-lg text-xs"
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
        <div className="m-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive shrink-0 flex items-center gap-2">
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
            <div className="h-full overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {/* Execution Timeline */}
              <div className="space-y-6">
                <h3 className="text-lg font-bold tracking-tight">
                  Execution Timeline
                </h3>
                <div className="relative before:absolute before:left-4 before:top-4 before:bottom-4 before:w-px before:bg-gradient-to-b before:from-muted before:via-muted before:to-transparent">
                  {agent.steps.map((step, index) => {
                    const state = stepStates[index] ?? { status: "pending" };
                    const isCompleted = state.status === "completed";
                    const isCurrent = state.status === "running";
                    const isAwaiting = state.status === "awaiting_review";
                    const isSelected = selectedStepIndex === index;

                    return (
                      <div
                        key={step.id}
                        className={`relative pl-10 pb-6 last:pb-0 group transition-all duration-200 ${
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
                          className={`absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border-muted-foreground/10 bg-background z-10 transition-all shadow-sm ${
                            isCompleted
                              ? "border border-green-500 text-green-500 bg-green-50/50"
                              : isCurrent
                                ? "border border-blue-500 text-blue-500 animate-pulse ring-4 ring-blue-500/10"
                                : isAwaiting
                                  ? "border border-amber-500 text-amber-500 bg-amber-50/50"
                                  : "border text-muted-foreground"
                          } ${isSelected ? "ring-2 ring-primary/20 shadow-md" : ""}`}
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
                          className={`p-4 rounded-xl border transition-all ${
                            isSelected
                              ? "bg-primary/5 border-primary/20 shadow-sm translate-x-1"
                              : "bg-transparent border-transparent hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <h4
                              className={`font-bold text-sm ${isSelected ? "text-primary" : ""}`}
                            >
                              {step.name}
                            </h4>
                            {isCompleted && (
                              <Badge
                                variant="secondary"
                                className="h-4 text-[10px] bg-green-500/10 text-green-700 border-green-500/20 uppercase tracking-tighter"
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

                          <p className="text-xs text-muted-foreground line-clamp-2">
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
              {run.status === "completed" &&
                run.outputAttachmentIds.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 flex items-center gap-2">
                      <Download className="h-3 w-3" />
                      Final Results
                    </h4>
                    <div className="grid gap-2">
                      {run.outputAttachmentIds.map((id) => {
                        const meta = attachmentMeta[id];
                        if (!meta) return null;
                        return (
                          <Card
                            key={id}
                            className="bg-primary/5 border-primary/10 overflow-hidden group hover:border-primary/30 transition-colors py-0.5"
                          >
                            <CardContent className="p-0">
                              <a
                                href={meta.url}
                                download={meta.name}
                                className="flex items-center justify-between p-3 hover:bg-primary/5 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-lg bg-background shadow-sm border border-primary/10">
                                    <Download className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="space-y-0.5">
                                    <p className="text-sm font-bold truncate max-w-[200px]">
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
                                  className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
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
              <div className="rounded-xl bg-blue-50/50 p-4 border border-blue-100/50 backdrop-blur-sm">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-blue-900">
                      Storage Optimization
                    </p>
                    <p className="text-xs text-blue-700/80 leading-relaxed">
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
                className="bg-card hidden lg:block"
              >
                <div className="h-full relative overflow-hidden">
                  {currentArtifact ? (
                    <ArtifactPanel
                      artifact={currentArtifact}
                      isOpen={isArtifactOpen}
                      onClose={() => setIsArtifactOpen(false)}
                      isFullWidth={true}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-12 text-center gap-6 bg-muted/5">
                      <div className="relative">
                        <div className="absolute -inset-4 bg-primary/10 rounded-full blur-2xl animate-pulse" />
                        <div className="h-20 w-20 rounded-2xl bg-card border shadow-xl flex items-center justify-center relative">
                          <Play className="h-10 w-10 text-primary/40" />
                        </div>
                      </div>
                      <div className="space-y-2 max-w-sm">
                        <p className="text-lg font-bold text-foreground">
                          Step Preview
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground/80">
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
