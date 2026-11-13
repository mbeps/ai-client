"use client";

import { Bot, FileCode, Loader2, Workflow } from "lucide-react";
import { useMemo, useState } from "react";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { ScratchpadViewerModal } from "@/components/chat/message/scratchpad-viewer-modal";
import { TraceContextUsage } from "@/components/chat/message/trace-context-usage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import { extractSubagentOutputText } from "@/lib/chat/extract-subagent-output";
import { resolveSubagentOutcome } from "@/lib/chat/resolve-subagent-outcome";
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

interface SubagentTraceDetailsProps {
  taskBrief: string;
  inputData?: string;
  outputText: string | null;
  result?: unknown;
}

/**
 * Renders the collapsible details for a subagent trace step.
 *
 * @param props - Subagent prompt, context, and findings.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function SubagentTraceDetails({
  taskBrief,
  inputData,
  outputText,
  result,
}: SubagentTraceDetailsProps) {
  return (
    <div className="bg-muted/20 mt-2 space-y-3 rounded-md p-3 text-xs">
      <TraceContextUsage args={{ taskBrief, inputData }} result={result} />

      <div>
        <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
          <Workflow className="h-3 w-3 text-purple-600 dark:text-purple-400" />
          <span>Delegated Prompt</span>
        </div>
        <div className="text-foreground rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-xs leading-relaxed">
          <MarkdownRenderer content={taskBrief} />
        </div>
      </div>

      {inputData && (
        <div>
          <div className="text-muted-foreground mb-1.5 text-[10px] font-bold tracking-wider uppercase">
            Context Pointers & Input Data
          </div>
          <div className="border-border/40 bg-muted/40 text-muted-foreground overflow-x-auto rounded-lg border p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {inputData}
          </div>
        </div>
      )}

      {outputText && (
        <div>
          <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
            <Bot className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            <span>Worker Findings</span>
          </div>
          <div className="border-border/60 bg-background/80 text-foreground rounded-lg border p-3 text-xs leading-relaxed shadow-xs">
            <MarkdownRenderer content={outputText} />
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

  const roleStyle = ROLE_STYLES[role.toLowerCase()] ?? {
    label: agentName ?? role,
    bg: "bg-purple-500/10 dark:bg-purple-500/20",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-500/30",
  };
  const displayLabel = agentName ?? roleStyle.label;

  const outputText = useMemo(() => extractSubagentOutputText(result), [result]);

  const outcome = useMemo(
    () => resolveSubagentOutcome(state, outputText),
    [state, outputText],
  );

  const isRunning = state === "running";
  const isError = state === "error" || outcome.isError;
  const status = resolveTraceLineStatus(isRunning, isError);

  return (
    <TraceCollapsible>
      <div className="flex w-full items-center justify-between gap-1">
        <TraceCollapsibleTrigger className="min-w-0 flex-1">
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
              title={agentId}
              className={cn(
                "px-1.5 py-0 font-mono text-[10px] uppercase",
                roleStyle.bg,
                roleStyle.text,
                roleStyle.border,
              )}
            >
              {displayLabel}
            </Badge>
            <TraceTitle className="truncate font-normal">
              {taskBrief}
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
        {messageId && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setScratchpadOpen(true)}
            className="h-6 shrink-0 cursor-pointer gap-1 border-purple-500/30 px-2 text-[10px] text-purple-700 hover:bg-purple-500/10 dark:text-purple-300"
          >
            <FileCode className="h-3 w-3" />
            <span>Scratchpad</span>
          </Button>
        )}
      </div>
      <TraceCollapsibleContent>
        <SubagentTraceDetails
          taskBrief={taskBrief}
          inputData={inputData}
          outputText={outputText}
          result={result}
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
