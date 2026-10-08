"use client";

import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Terminal,
  XCircle,
} from "lucide-react";
import { Accordion } from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { cn } from "@/lib/utils";
import { SubagentActivityCard } from "./subagent-activity-card";

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
  messageId?: string;
  chatId?: string;
}

/**
 * Displays a collapsible sequence of MCP tool calls and their results.
 * Groups subagent delegations into a unified single-collapsible Accordion.
 * Used in ResponseTimeline to visualize tool usage during AI processing.
 *
 * @param props.toolCalls - Array of tool calls initiated by the model.
 * @param props.toolResults - Array of tool execution results.
 * @param props.initialOpen - Whether to show tool details expanded on first render.
 * @param props.messageId - Optional assistant message ID for scratchpad inspection.
 * @param props.chatId - Optional chat ID for scratchpad authorization.
 * @author Maruf Bepary
 */
export function ToolCallDisplay({
  toolCalls,
  toolResults,
  initialOpen = false,
  messageId,
  chatId,
}: ToolCallDisplayProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  const isSubagentCall = (tc: ToolCall) =>
    tc.toolName === "delegate_task" ||
    tc.toolName === INTERNAL_TOOL_IDS.DELEGATE_TASK;

  type RenderChunk =
    | { type: "subagents"; items: ToolCall[] }
    | { type: "standard"; item: ToolCall };

  const chunks: RenderChunk[] = [];
  for (const tc of toolCalls) {
    if (isSubagentCall(tc)) {
      const last = chunks[chunks.length - 1];
      if (last && last.type === "subagents") {
        last.items.push(tc);
      } else {
        chunks.push({ type: "subagents", items: [tc] });
      }
    } else {
      chunks.push({ type: "standard", item: tc });
    }
  }

  return (
    <div className="mb-3 space-y-2">
      {chunks.map((chunk, chunkIdx) => {
        if (chunk.type === "subagents") {
          const defaultOpenId =
            chunk.items.find(
              (tc) =>
                !toolResults.some((tr) => tr.toolCallId === tc.toolCallId),
            )?.toolCallId ??
            (initialOpen ? chunk.items[0]?.toolCallId : undefined);

          return (
            <Accordion
              key={`subagents-group-${chunk.items[0].toolCallId || chunkIdx}`}
              type="single"
              collapsible
              defaultValue={defaultOpenId}
              className="w-full space-y-2"
            >
              {chunk.items.map((tc) => {
                const result = toolResults.find(
                  (tr) => tr.toolCallId === tc.toolCallId,
                );
                const isCompleted = !!result;
                const isError = isCompleted && (result.result as any)?.error;
                const args = (tc.args ?? {}) as {
                  role?: string;
                  taskBrief?: string;
                  inputData?: string;
                };

                return (
                  <SubagentActivityCard
                    key={tc.toolCallId}
                    accordionValue={tc.toolCallId}
                    role={args.role}
                    taskBrief={args.taskBrief}
                    inputData={args.inputData}
                    status={
                      isCompleted ? (isError ? "error" : "complete") : "pending"
                    }
                    result={result?.result}
                    messageId={messageId}
                    chatId={chatId}
                    initialOpen={initialOpen}
                  />
                );
              })}
            </Accordion>
          );
        }

        const tc = chunk.item;
        const result = toolResults.find(
          (tr) => tr.toolCallId === tc.toolCallId,
        );
        const isCompleted = !!result;
        const isError = isCompleted && (result?.result as any)?.error;

        return (
          <div key={tc.toolCallId || chunkIdx}>
            <Collapsible
              defaultOpen={initialOpen}
              className="w-full overflow-hidden rounded-lg border border-muted bg-muted/20"
            >
              <CollapsibleTrigger className="flex w-full items-center gap-2 p-2.5 font-medium text-sm outline-none transition-colors hover:bg-muted/30">
                <div className="flex flex-1 items-center gap-2 text-muted-foreground">
                  <div className="relative">
                    <Terminal className="size-4" />
                    {!isCompleted && (
                      <div className="absolute -top-1 -right-1">
                        <Loader2 className="size-2 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-xs">
                    {tc.serverName
                      ? `${tc.serverName} > ${tc.toolName}`
                      : tc.toolName}
                  </span>
                  {isCompleted && (
                    <div className="ml-2 flex items-center gap-1.5">
                      {isError ? (
                        <XCircle className="size-3.5 text-destructive" />
                      ) : (
                        <CheckCircle2 className="size-3.5 text-success" />
                      )}
                      <span
                        className={cn(
                          "font-bold text-[10px] uppercase",
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
                <div className="border-muted border-t bg-muted/5 p-3 pt-0">
                  <div className="mt-2 space-y-3">
                    <div>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                          Arguments
                        </span>
                        <div className="h-px flex-1 bg-muted" />
                      </div>
                      <div className="max-h-60 overflow-y-auto overflow-x-hidden rounded-md bg-zinc-950/90 ring-1 ring-white/5 ring-inset dark:bg-black/40">
                        <div className="p-2.5">
                          <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-zinc-300 leading-relaxed">
                            {JSON.stringify(tc.args, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>

                    {isCompleted && (
                      <div>
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className="font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
                            Result
                          </span>
                          <div className="h-px flex-1 bg-muted" />
                        </div>
                        <div
                          className={cn(
                            "max-h-80 overflow-y-auto overflow-x-hidden rounded-md ring-1 ring-inset",
                            isError
                              ? "bg-destructive/5 text-destructive ring-destructive/20"
                              : "bg-zinc-950/90 text-zinc-300 ring-white/5 dark:bg-black/40",
                          )}
                        >
                          <div className="p-2.5">
                            <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
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
