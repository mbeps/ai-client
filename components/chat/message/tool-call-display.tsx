"use client";

import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Database,
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
import {
  estimateToolContextTokens,
  formatTokens,
} from "@/lib/chat/calculate-context-tokens";
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

type RenderChunk =
  | { type: "subagents"; items: ToolCall[] }
  | { type: "standard"; item: ToolCall };

function isSubagentCall(tc: ToolCall): boolean {
  return (
    tc.toolName === "delegate_task" ||
    tc.toolName === INTERNAL_TOOL_IDS.DELEGATE_TASK
  );
}

function groupToolCallsIntoChunks(toolCalls: ToolCall[]): RenderChunk[] {
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
  return chunks;
}

function resolveSubagentDefaultOpen(
  items: ToolCall[],
  toolResults: ToolResult[],
  initialOpen: boolean,
): string[] {
  const pendingItem = items.find(
    (tc) => !toolResults.some((tr) => tr.toolCallId === tc.toolCallId),
  );
  const defaultOpenId =
    pendingItem?.toolCallId ?? (initialOpen ? items[0]?.toolCallId : undefined);
  return defaultOpenId ? [defaultOpenId] : [];
}

interface SubagentChunkAccordionProps {
  chunk: { type: "subagents"; items: ToolCall[] };
  chunkIdx: number;
  toolResults: ToolResult[];
  initialOpen: boolean;
  messageId?: string;
  chatId?: string;
}

function SubagentChunkAccordion({
  chunk,
  chunkIdx,
  toolResults,
  initialOpen,
  messageId,
  chatId,
}: SubagentChunkAccordionProps) {
  const defaultOpenValues = resolveSubagentDefaultOpen(
    chunk.items,
    toolResults,
    initialOpen,
  );
  const groupKey = `subagents-group-${chunk.items[0]?.toolCallId || chunkIdx}`;

  return (
    <Accordion
      key={groupKey}
      type="multiple"
      defaultValue={defaultOpenValues}
      className="w-full space-y-2"
    >
      {chunk.items.map((tc) => {
        const result = toolResults.find(
          (tr) => tr.toolCallId === tc.toolCallId,
        );
        const isCompleted = Boolean(result);
        const isError = Boolean(isCompleted && (result?.result as any)?.error);
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
            status={isCompleted ? (isError ? "error" : "complete") : "pending"}
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

function ToolCallHeaderTitle({
  toolName,
  serverName,
  isMcpCall,
}: {
  toolName: string;
  serverName?: string;
  isMcpCall: boolean;
}) {
  if (isMcpCall) {
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

function ToolCallStatusBadge({ isError }: { isError: boolean }) {
  return (
    <div className="ml-2 flex items-center gap-1.5">
      {isError ? (
        <XCircle className="text-destructive size-3.5" />
      ) : (
        <CheckCircle2 className="text-success size-3.5" />
      )}
      <span
        className={cn(
          "text-[10px] font-bold uppercase",
          isError ? "text-destructive" : "text-success",
        )}
      >
        {isError ? "Failed" : "Success"}
      </span>
    </div>
  );
}

function ToolCallContextUsage({ tokens }: { tokens: number }) {
  return (
    <div className="border-border/40 bg-muted/30 flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs">
      <div className="text-muted-foreground flex items-center gap-1.5">
        <Database className="text-muted-foreground size-3.5" />
        <span className="font-medium">Context Usage</span>
      </div>
      <span className="text-foreground/80 font-mono text-[11px]">
        ~{formatTokens(tokens)} tokens
      </span>
    </div>
  );
}

function ToolCallArgumentsDisplay({ args }: { args: unknown }) {
  return (
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
  );
}

function ToolCallResultDisplay({
  result,
  isError,
}: {
  result: unknown;
  isError: boolean;
}) {
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

interface StandardToolCallCollapsibleProps {
  toolCall: ToolCall;
  chunkIdx: number;
  toolResults: ToolResult[];
  initialOpen: boolean;
}

function isMcpServer(name?: string): boolean {
  if (!name) return false;
  return name !== "Internal" && name !== "System";
}

function deriveToolCallViewState(
  toolCall: ToolCall,
  toolResults: ToolResult[],
) {
  const result = toolResults.find(
    (tr) => tr.toolCallId === toolCall.toolCallId,
  );
  const isCompleted = Boolean(result);
  const resultObj = result?.result;
  const isError = Boolean(
    isCompleted &&
      typeof resultObj === "object" &&
      resultObj !== null &&
      "error" in resultObj,
  );
  const serverName = toolCall.serverName ?? result?.serverName;
  const isMcpCall = isMcpServer(serverName);
  const estimatedTokens = estimateToolContextTokens(toolCall.args, resultObj);

  return {
    result,
    isCompleted,
    isError,
    serverName,
    isMcpCall,
    estimatedTokens,
  };
}

function ToolCallTriggerContent({
  isCompleted,
  toolName,
  serverName,
  isMcpCall,
  isError,
}: {
  isCompleted: boolean;
  toolName: string;
  serverName?: string;
  isMcpCall: boolean;
  isError: boolean;
}) {
  return (
    <div className="text-muted-foreground flex flex-1 items-center gap-2">
      <div className="relative">
        <Terminal className="size-4" />
        {!isCompleted && (
          <div className="absolute -top-1 -right-1">
            <Loader2 className="text-primary size-2 animate-spin" />
          </div>
        )}
      </div>
      <ToolCallHeaderTitle
        toolName={toolName}
        serverName={serverName}
        isMcpCall={isMcpCall}
      />
      {isCompleted && <ToolCallStatusBadge isError={isError} />}
    </div>
  );
}

function ToolCallCollapsibleBody({
  estimatedTokens,
  args,
  isCompleted,
  result,
  isError,
}: {
  estimatedTokens: number;
  args: unknown;
  isCompleted: boolean;
  result: unknown;
  isError: boolean;
}) {
  return (
    <CollapsibleContent>
      <div className="border-muted bg-muted/5 border-t p-3 pt-0">
        <div className="mt-2 space-y-3">
          <ToolCallContextUsage tokens={estimatedTokens} />
          <ToolCallArgumentsDisplay args={args} />
          {isCompleted && (
            <ToolCallResultDisplay result={result} isError={isError} />
          )}
        </div>
      </div>
    </CollapsibleContent>
  );
}

function StandardToolCallCollapsible({
  toolCall,
  chunkIdx,
  toolResults,
  initialOpen,
}: StandardToolCallCollapsibleProps) {
  const {
    result,
    isCompleted,
    isError,
    serverName,
    isMcpCall,
    estimatedTokens,
  } = deriveToolCallViewState(toolCall, toolResults);
  const elementKey = toolCall.toolCallId || String(chunkIdx);

  return (
    <div key={elementKey}>
      <Collapsible
        defaultOpen={initialOpen}
        className="border-muted bg-muted/20 w-full overflow-hidden rounded-lg border"
      >
        <CollapsibleTrigger className="hover:bg-muted/30 flex w-full items-center gap-2 p-2.5 text-sm font-medium transition-colors outline-none">
          <ToolCallTriggerContent
            isCompleted={isCompleted}
            toolName={toolCall.toolName}
            serverName={serverName}
            isMcpCall={isMcpCall}
            isError={isError}
          />
          <ChevronDown className="text-muted-foreground size-4 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
        </CollapsibleTrigger>
        <ToolCallCollapsibleBody
          estimatedTokens={estimatedTokens}
          args={toolCall.args}
          isCompleted={isCompleted}
          result={result?.result}
          isError={isError}
        />
      </Collapsible>
    </div>
  );
}

/**
 * Displays a collapsible sequence of MCP tool calls and their results.
 * Groups subagent delegations into an independent, multi-expandable Accordion group.
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

  const chunks = groupToolCallsIntoChunks(toolCalls);

  return (
    <div className="mb-3 space-y-2">
      {chunks.map((chunk, chunkIdx) =>
        chunk.type === "subagents" ? (
          <SubagentChunkAccordion
            key={`subagents-group-${chunk.items[0]?.toolCallId || chunkIdx}`}
            chunk={chunk}
            chunkIdx={chunkIdx}
            toolResults={toolResults}
            initialOpen={initialOpen}
            messageId={messageId}
            chatId={chatId}
          />
        ) : (
          <StandardToolCallCollapsible
            key={chunk.item.toolCallId || chunkIdx}
            toolCall={chunk.item}
            chunkIdx={chunkIdx}
            toolResults={toolResults}
            initialOpen={initialOpen}
          />
        ),
      )}
    </div>
  );
}
