"use client";

import {
  Bot,
  Clock,
  Cpu,
  FileCode,
  Info,
  Layers,
  Loader2,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getScratchpadFilesAction } from "@/actions/subagents/get-scratchpad";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { ReasoningTraceStep } from "@/components/chat/message/reasoning-trace-step";
import { ScratchpadViewerModal } from "@/components/chat/message/scratchpad-viewer-modal";
import { ToolTraceStep } from "@/components/chat/message/tool-trace-step";
import { TraceContextUsage } from "@/components/chat/message/trace-context-usage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import { extractSubagentOutputText } from "@/lib/chat/extract-subagent-output";
import {
  parseSubagentResult,
  type SubagentExecutionMetadata,
} from "@/lib/chat/parse-subagent-parts";
import { resolveSubagentOutcome } from "@/lib/chat/resolve-subagent-outcome";
import { useAppStore } from "@/lib/store/use-app-store";
import { cn } from "@/lib/utils";

const ROLE_STYLES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  researcher: {
    label: "Researcher",
    bg: "bg-blue-500/10 dark:bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-500/30",
  },
  planner: {
    label: "Planner",
    bg: "bg-amber-500/10 dark:bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-500/30",
  },
  reviewer: {
    label: "Reviewer",
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
  },
  worker: {
    label: "Worker",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-500/30",
  },
};

const EMPTY_INPUT_RE = /^\{\s*\}$/;
const STATUS_PREFIX_RE =
  /^(?:\*{0,2})STATUS:\s*(?:DONE|DONE_WITH_CONCERNS|NEEDS_CONTEXT|BLOCKED)(?:\*{0,2})[:\s-]*/i;

/**
 * Properties for rendering an individual subagent execution trace step.
 */
export interface SubagentTraceStepProps {
  toolCallId: string;
  role: string;
  agentId?: string;
  agentName?: string;
  taskBrief: string;
  inputData?: string;
  result?: unknown;
  state: "running" | "done" | "error";
  messageId?: string;
  chatId?: string;
}

/**
 * Resolves the trace line visual status from the running and error states.
 *
 * @param isRunning - Whether the execution is currently in progress.
 * @param isError - Whether the step failed or produced an error outcome.
 * @returns Status string for TraceLine.
 * @author Maruf Bepary
 */
export function resolveTraceLineStatus(
  isRunning: boolean,
  isError: boolean,
): "running" | "error" | undefined {
  if (isRunning) return "running";
  if (isError) return "error";
  return undefined;
}

function formatSubagentDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
}

function SubagentMetadataBar({
  metadata,
}: {
  metadata?: SubagentExecutionMetadata;
}) {
  if (!metadata) return null;

  const hasContent =
    metadata.modelId ||
    metadata.durationMs !== undefined ||
    metadata.stepCount !== undefined ||
    metadata.usage?.totalTokens !== undefined;
  if (!hasContent) return null;

  return (
    <div className="border-border/40 bg-muted/30 text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-2.5 py-1.5 text-[11px]">
      {metadata.modelId && (
        <span className="inline-flex items-center gap-1 font-mono">
          <Cpu className="size-3 shrink-0" />
          <span className="text-foreground/80">{metadata.modelId}</span>
        </span>
      )}
      {metadata.durationMs !== undefined && (
        <span className="inline-flex items-center gap-1 font-mono">
          <Clock className="size-3 shrink-0" />
          <span>{formatSubagentDuration(metadata.durationMs)}</span>
        </span>
      )}
      {metadata.stepCount !== undefined && (
        <span className="inline-flex items-center gap-1 font-mono">
          <Layers className="size-3 shrink-0" />
          <span>
            {metadata.maxSteps !== undefined
              ? `${metadata.stepCount} / ${metadata.maxSteps} steps`
              : `${metadata.stepCount} steps`}
          </span>
        </span>
      )}
      {metadata.usage?.totalTokens !== undefined && (
        <span className="font-mono">
          {metadata.usage.totalTokens.toLocaleString()} tokens
        </span>
      )}
      {metadata.finishReason && metadata.finishReason !== "stop" && (
        <Badge variant="outline" className="px-1.5 py-0 font-mono text-[10px]">
          {metadata.finishReason}
        </Badge>
      )}
    </div>
  );
}

interface SubagentTraceDetailsProps {
  taskBrief: string;
  inputData?: string;
  result?: unknown;
  isRunning: boolean;
  canUseScratchpad: boolean;
  messageId?: string;
  chatId?: string;
  onOpenScratchpad: () => void;
}

/**
 * Renders the collapsible details for a subagent trace step.
 * Mounted only when the accordion is expanded.
 *
 * @author Maruf Bepary
 */
function SubagentTraceDetails({
  taskBrief,
  inputData,
  result,
  isRunning,
  canUseScratchpad,
  messageId,
  chatId,
  onOpenScratchpad,
}: SubagentTraceDetailsProps) {
  const [scratchpadFileCount, setScratchpadFileCount] = useState(0);

  const parsed = useMemo(() => parseSubagentResult(result), [result]);

  useEffect(() => {
    if (
      isRunning ||
      !canUseScratchpad ||
      !messageId ||
      messageId === "streaming"
    ) {
      return;
    }
    let cancelled = false;
    const load = chatId
      ? getScratchpadFilesAction(chatId, messageId)
      : getScratchpadFilesAction(messageId);
    load
      .then((res) => {
        if (!cancelled && res.ok) {
          setScratchpadFileCount(res.value.length);
        }
      })
      .catch(() => {
        // Non-fatal: scratchpad button stays hidden on transient lookup error
      });
    return () => {
      cancelled = true;
    };
  }, [canUseScratchpad, chatId, messageId, isRunning]);

  const trimmedInput = inputData?.trim() ?? "";
  const hasInputData = Boolean(
    trimmedInput &&
      !EMPTY_INPUT_RE.test(trimmedInput) &&
      trimmedInput !== "None provided.",
  );

  const rawFindings =
    parsed.textContent || (!isRunning ? extractSubagentOutputText(result) : "");
  const displayFindings = rawFindings
    ? rawFindings.replace(STATUS_PREFIX_RE, "").trim() || rawFindings
    : "";

  const hasTraceActivity =
    parsed.reasoningText.length > 0 ||
    parsed.isStreamingReasoning ||
    parsed.toolSteps.length > 0;

  const showScratchpadButton =
    canUseScratchpad &&
    Boolean(messageId) &&
    (scratchpadFileCount > 0 || parsed.hasScratchpadWrite);

  return (
    <div className="bg-muted/20 mt-2 space-y-3 rounded-md p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <TraceContextUsage args={{ taskBrief, inputData }} result={result} />
        </div>
        {showScratchpadButton && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenScratchpad}
            className="h-7 shrink-0 cursor-pointer gap-1.5 border-purple-500/30 px-2.5 text-[11px] text-purple-700 hover:bg-purple-500/10 dark:text-purple-300"
          >
            <FileCode className="h-3.5 w-3.5" />
            <span>Scratchpad</span>
            {scratchpadFileCount > 0 && (
              <Badge
                variant="secondary"
                className="px-1.5 py-0 font-mono text-[10px]"
              >
                {scratchpadFileCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      <SubagentMetadataBar metadata={parsed.metadata} />

      <div>
        <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
          <Workflow className="h-3 w-3 text-purple-600 dark:text-purple-400" />
          <span>Delegated Prompt</span>
        </div>
        <div className="text-foreground rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs leading-relaxed">
          <MarkdownRenderer content={taskBrief} />
        </div>
      </div>

      {hasInputData && (
        <div>
          <div className="text-muted-foreground mb-1.5 text-[10px] font-bold tracking-wider uppercase">
            Context Pointers & Input Data
          </div>
          <div className="border-border/40 bg-muted/40 text-muted-foreground overflow-x-auto rounded-lg border p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {inputData}
          </div>
        </div>
      )}

      {hasTraceActivity && (
        <div>
          <div className="text-muted-foreground mb-1.5 text-[10px] font-bold tracking-wider uppercase">
            Execution Trace
          </div>
          <div className="border-border/50 bg-background/50 rounded-lg border p-2.5">
            <Trace>
              {(parsed.reasoningText.length > 0 ||
                parsed.isStreamingReasoning) && (
                <ReasoningTraceStep
                  text={parsed.reasoningText}
                  running={parsed.isStreamingReasoning}
                />
              )}
              {parsed.toolSteps.map((step) => (
                <ToolTraceStep
                  key={step.toolCallId}
                  toolCallId={step.toolCallId}
                  toolName={step.toolName}
                  serverName={step.serverName}
                  isMcp={Boolean(step.serverName)}
                  args={step.args}
                  result={step.result}
                  state={step.status === "calling" ? "running" : "done"}
                />
              ))}
            </Trace>
          </div>
        </div>
      )}

      {(displayFindings || isRunning) && (
        <div>
          <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
            <Bot className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            <span>Worker Findings</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Worker findings info"
                    className="text-muted-foreground/70 hover:text-foreground inline-flex cursor-help items-center"
                  >
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  This output is returned to the main agent.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="border-border/60 bg-background/80 text-foreground rounded-lg border p-3 text-xs leading-relaxed shadow-xs">
            {displayFindings ? (
              <>
                <MarkdownRenderer content={displayFindings} />
                {isRunning && parsed.isStreamingText && (
                  <span className="bg-primary/40 ml-1 inline-block h-3.5 w-1.5 animate-pulse align-middle" />
                )}
              </>
            ) : (
              <span className="text-muted-foreground inline-flex items-center gap-1.5 italic">
                <Loader2 className="h-3 w-3 animate-spin" />
                Subagent is working...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renders a delegated subagent activity step inside a Trace container.
 *
 * @author Maruf Bepary
 */
export function SubagentTraceStep({
  role,
  agentId,
  agentName,
  taskBrief,
  inputData,
  result,
  state,
  messageId,
  chatId,
}: SubagentTraceStepProps) {
  const [scratchpadOpen, setScratchpadOpen] = useState(false);
  const agents = useAppStore((s) => s.agents);

  const lookupKey = agentId ?? role;
  const resolvedAgent = agents?.find(
    (a) =>
      a.id === lookupKey || a.name.toLowerCase() === lookupKey.toLowerCase(),
  );
  const effectiveAgentName = agentName ?? resolvedAgent?.name;
  const effectiveAgentId = agentId ?? resolvedAgent?.id;

  const customStyle = {
    label: effectiveAgentName ?? role,
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
  };
  const isCustomAgent = Boolean(
    (resolvedAgent && !resolvedAgent.isBuiltIn) ||
      (effectiveAgentName && !ROLE_STYLES[effectiveAgentName.toLowerCase()]),
  );
  const roleStyle = isCustomAgent
    ? customStyle
    : (ROLE_STYLES[role.toLowerCase()] ?? customStyle);
  const displayLabel = effectiveAgentName ?? roleStyle.label;

  const outputText = useMemo(() => extractSubagentOutputText(result), [result]);
  const parsedSummary = useMemo(() => parseSubagentResult(result), [result]);

  const outcome = useMemo(
    () => resolveSubagentOutcome(state, outputText),
    [state, outputText],
  );

  const isRunning = state === "running";
  const isError = state === "error" || outcome.isError;
  const status = resolveTraceLineStatus(isRunning, isError);
  const canUseScratchpad =
    resolvedAgent?.guardrails?.scratchpadAccess !== "none";

  const headerMeta: string[] = [];
  if (parsedSummary.toolSteps.length > 0) {
    headerMeta.push(
      `${parsedSummary.toolSteps.length} ${parsedSummary.toolSteps.length === 1 ? "tool" : "tools"}`,
    );
  }
  if (parsedSummary.metadata?.durationMs !== undefined) {
    headerMeta.push(formatSubagentDuration(parsedSummary.metadata.durationMs));
  }

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine status={status}>
          <TraceIcon>
            {isRunning ? (
              <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bot className="h-3.5 w-3.5 text-purple-500" />
            )}
          </TraceIcon>
          <Badge
            variant="outline"
            title={effectiveAgentId}
            className={cn(
              "px-1.5 py-0 font-mono text-[10px] uppercase",
              roleStyle.bg,
              roleStyle.text,
              roleStyle.border,
            )}
          >
            {displayLabel}
          </Badge>
          <TraceTitle className="text-muted-foreground text-xs font-normal">
            {headerMeta.length > 0 ? headerMeta.join(" · ") : ""}
          </TraceTitle>
          <Badge
            variant={outcome.isError ? "destructive" : "outline"}
            className={cn(
              "rounded-full px-2 py-0 text-[10px] font-medium",
              !outcome.isError &&
                outcome.label === "Concerns" &&
                "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
              !outcome.isError &&
                outcome.label === "Needs Context" &&
                "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
            )}
          >
            {outcome.label}
          </Badge>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <SubagentTraceDetails
          taskBrief={taskBrief}
          inputData={inputData}
          result={result}
          isRunning={isRunning}
          canUseScratchpad={canUseScratchpad}
          messageId={messageId}
          chatId={chatId}
          onOpenScratchpad={() => setScratchpadOpen(true)}
        />
      </TraceCollapsibleContent>

      {messageId && (
        <ScratchpadViewerModal
          open={scratchpadOpen}
          onOpenChange={setScratchpadOpen}
          messageId={messageId}
          chatId={chatId}
        />
      )}
    </TraceCollapsible>
  );
}
