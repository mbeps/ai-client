"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { TraceContextUsage } from "@/components/chat/message/trace-context-usage";
import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import { getInternalToolDisplayName } from "@/config/tools";
import { cn } from "@/lib/utils";

/**
 * Properties for rendering an individual tool execution trace step.
 */
export interface ToolTraceStepProps {
  toolCallId: string;
  toolName: string;
  serverName?: string;
  isMcp: boolean;
  args: unknown;
  result?: unknown;
  state: "running" | "done" | "error";
}

interface ToolTraceTitleProps {
  isMcp: boolean;
  serverName?: string;
  toolName: string;
}

/**
 * Renders the tool title displaying human-readable names for internal tools or server separation for MCP tools.
 *
 * @param props - Tool naming properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function ToolTraceTitle({
  isMcp,
  serverName,
  toolName,
}: ToolTraceTitleProps) {
  const isServerInternal =
    !serverName || serverName === "Internal" || serverName === "System";
  const internalDisplayName = isServerInternal
    ? getInternalToolDisplayName(toolName)
    : undefined;

  if (internalDisplayName) {
    return (
      <span className="text-foreground/90 text-xs font-semibold">
        {internalDisplayName}
      </span>
    );
  }

  if (isMcp && serverName) {
    return (
      <span className="flex items-center gap-1.5 font-mono text-xs">
        <span className="text-foreground/90 font-semibold">{serverName}</span>
        <Circle className="fill-muted-foreground/50 text-muted-foreground/50 size-1.5" />
        <span>{toolName}</span>
      </span>
    );
  }
  return <span className="font-mono text-xs">{toolName}</span>;
}

interface ToolTraceResultPanelProps {
  isError: boolean;
  result: unknown;
}

/**
 * Renders the completed tool result payload box.
 *
 * @param props - Execution result and error status.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function ToolTraceResultPanel({
  isError,
  result,
}: ToolTraceResultPanelProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
          Result
        </span>
        <div className="bg-muted h-px flex-1" />
      </div>
      <div
        className={cn(
          "max-h-80 overflow-x-hidden overflow-y-auto rounded-md ring-1 ring-inset",
          isError
            ? "bg-destructive/5 text-destructive ring-destructive/20"
            : "bg-zinc-950/90 text-zinc-300 ring-white/5 dark:bg-black/40",
        )}
      >
        <div className="p-2.5">
          <pre className="font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap">
            {typeof result === "string"
              ? result
              : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders an MCP or system tool execution step inside a Trace container.
 *
 * @author Maruf Bepary
 */
export function ToolTraceStep({
  toolName,
  serverName,
  isMcp,
  args,
  result,
  state,
}: ToolTraceStepProps) {
  const isError = state === "error";
  const isRunning = state === "running";
  const status: "running" | "error" | undefined = isRunning
    ? "running"
    : isError
      ? "error"
      : undefined;

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine status={status}>
          <TraceIcon>
            {isRunning ? (
              <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
            ) : isError ? (
              <XCircle className="text-destructive h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="text-success h-3.5 w-3.5" />
            )}
          </TraceIcon>
          <TraceTitle>
            <ToolTraceTitle
              isMcp={isMcp}
              serverName={serverName}
              toolName={toolName}
            />
          </TraceTitle>
          <TraceDescription className="text-muted-foreground text-[11px]">
            {isRunning ? "Running..." : isError ? "Failed" : "Success"}
          </TraceDescription>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <div className="bg-muted/20 mt-2 space-y-3 rounded-md p-3">
          <TraceContextUsage args={args} result={result} />
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                Arguments
              </span>
              <div className="bg-muted h-px flex-1" />
            </div>
            <div className="max-h-60 overflow-x-hidden overflow-y-auto rounded-md bg-zinc-950/90 ring-1 ring-white/5 ring-inset dark:bg-black/40">
              <div className="p-2.5">
                <pre className="font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap text-zinc-300">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            </div>
          </div>
          {!isRunning && (
            <ToolTraceResultPanel isError={isError} result={result} />
          )}
        </div>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}
