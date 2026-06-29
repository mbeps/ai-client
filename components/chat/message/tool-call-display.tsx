"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  initialOpen?: boolean;
}

/**
 * Displays a collapsible sequence of MCP tool calls and their results.
 * Shows tool name, arguments, and result status (pending or completed with result).
 * Used in ResponseTimeline to visualize tool usage during AI processing.
 *
 * @param props.toolCalls - Array of tool calls initiated by the model.
 * @param props.toolResults - Array of tool execution results.
 * @param props.initialOpen - Whether to show tool details expanded on first render.
 * @author Maruf Bepary
 */
export function ToolCallDisplay({
  toolCalls,
  toolResults,
  initialOpen = false,
}: ToolCallDisplayProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      {toolCalls.map((tc) => {
        const result = toolResults.find(
          (tr) => tr.toolCallId === tc.toolCallId,
        );
        const isCompleted = !!result;
        const isError = isCompleted && (result.result as any)?.error;

        return (
          <div key={tc.toolCallId} className="group/tool">
            <Collapsible
              defaultOpen={initialOpen}
              className="w-full rounded-lg border border-muted bg-muted/20 overflow-hidden"
            >
              <CollapsibleTrigger className="flex items-center gap-2 p-2.5 w-full text-sm font-medium transition-colors hover:bg-muted/30 outline-none">
                <div className="flex items-center gap-2 flex-1 text-muted-foreground">
                  <div className="relative">
                    <Terminal className="size-4" />
                    {!isCompleted && (
                      <div className="absolute -top-1 -right-1">
                        <Loader2 className="size-2 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-mono">
                    {tc.serverName
                      ? `${tc.serverName} > ${tc.toolName}`
                      : tc.toolName}
                  </span>
                  {isCompleted && (
                    <div className="flex items-center gap-1.5 ml-2">
                      {isError ? (
                        <XCircle className="size-3.5 text-destructive" />
                      ) : (
                        <CheckCircle2 className="size-3.5 text-success" />
                      )}
                      <span
                        className={cn(
                          "text-[10px] uppercase font-bold",
                          isError ? "text-destructive" : "text-success",
                        )}
                      >
                        {isError ? "Failed" : "Success"}
                      </span>
                    </div>
                  )}
                </div>
                <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 pt-0 border-t border-muted bg-muted/5">
                  <div className="mt-2 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                          Arguments
                        </span>
                        <div className="h-px flex-1 bg-muted" />
                      </div>
                      <div className="max-h-60 overflow-y-auto overflow-x-hidden rounded-md bg-zinc-950/90 dark:bg-black/40 ring-1 ring-inset ring-white/5">
                        <div className="p-2.5">
                          <pre className="text-[11px] font-mono leading-relaxed text-zinc-300 whitespace-pre-wrap break-all">
                            {JSON.stringify(tc.args, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {isCompleted && (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                            Result
                          </span>
                          <div className="h-px flex-1 bg-muted" />
                        </div>
                        <div
                          className={cn(
                            "max-h-80 overflow-y-auto overflow-x-hidden rounded-md ring-1 ring-inset",
                            isError
                              ? "bg-destructive/5 text-destructive ring-destructive/20"
                              : "bg-zinc-950/90 dark:bg-black/40 text-zinc-300 ring-white/5",
                          )}
                        >
                          <div className="p-2.5">
                            <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all">
                              {typeof result.result === "string"
                                ? result.result
                                : JSON.stringify(result.result, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        );
      })}
    </div>
  );
}
