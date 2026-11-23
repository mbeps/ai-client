"use client";

import type React from "react";
import { useMemo } from "react";
import { AssistantMessageBody } from "@/components/chat/message/assistant-message-body";
import { ResponseTimeline } from "@/components/chat/message/response-timeline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NodeStatusIndicator } from "@/components/workflows/canvas/node-status-indicator";
import { createInlineReasoningParser } from "@/lib/chat/stream/reasoning-stream-parser";
import { cn } from "@/lib/utils";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type {
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

/** Props for {@link WorkflowRunNodeCard}. */
export interface WorkflowRunNodeCardProps {
  node: WorkflowNode;
  state?: WorkflowNodeRunState;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Separates inline reasoning tags (e.g. `<think>...</think>`) from markdown reply content.
 */
function extractStepReasoningAndContent(summary?: string): {
  reasoning: string;
  content: string;
} {
  if (!summary) return { reasoning: "", content: "" };
  const parser = createInlineReasoningParser();
  const parts = [...parser.push(summary), ...parser.flush()];
  const reasoningParts: string[] = [];
  const contentParts: string[] = [];
  for (const part of parts) {
    if (part.type === "reasoning") {
      reasoningParts.push(part.text);
    } else {
      contentParts.push(part.text);
    }
  }
  return {
    reasoning: reasoningParts.join("\n\n").trim(),
    content: contentParts.join("").trim(),
  };
}

/**
 * Execution timeline card summarizing per-node status, branches, HTTP responses,
 * and chat-style reasoning/tool traces and markdown outputs.
 */
export function WorkflowRunNodeCard({
  node,
  state,
  isSelected,
  onClick,
}: WorkflowRunNodeCardProps) {
  const status = state?.status ?? "pending";
  const { reasoning, content } = useMemo(
    () => extractStepReasoningAndContent(state?.summary),
    [state?.summary],
  );
  const messageArtifacts = useMemo<ArtifactData[]>(
    () =>
      state?.artifact
        ? [{ ...state.artifact, messageId: `node-${node.id}` }]
        : [],
    [state?.artifact, node.id],
  );
  const hasTimeline = Boolean(reasoning || state?.toolCalls?.length);
  const hasBody = Boolean(content || messageArtifacts.length > 0);

  const handleOutputClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) {
      e.stopPropagation();
    }
  };

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-colors",
        isSelected
          ? "border-primary ring-primary/20 ring-2"
          : "hover:border-primary/40",
      )}
    >
      <CardContent className="space-y-3 p-4">
        <div
          className="focus-visible:ring-ring flex items-center justify-between gap-2 rounded outline-none focus-visible:ring-2"
          role="button"
          tabIndex={0}
          aria-label={`Select ${node.name}`}
          onKeyDown={(e) => {
            if (e.target !== e.currentTarget) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onClick();
            }
          }}
        >
          <div className="flex items-center gap-2">
            <NodeStatusIndicator status={status}>
              <span className="m-1 block h-2 w-2 rounded-full bg-current" />
            </NodeStatusIndicator>
            <span className="font-medium">{node.name}</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {`{{${node.data.variableName}}}`}
            </Badge>
          </div>
          <Badge variant="secondary" className="text-[11px] capitalize">
            {status.replaceAll("_", " ")}
          </Badge>
        </div>

        {state?.branchTaken && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant="outline"
              className={
                state.branchTaken === "true"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-rose-500 text-rose-600"
              }
            >
              Branch: {state.branchTaken}
            </Badge>
            {state.conditionReasoning && (
              <span className="text-muted-foreground">
                {state.conditionReasoning}
              </span>
            )}
          </div>
        )}

        {state?.httpResponse && (
          <p className="text-muted-foreground font-mono text-xs">
            HTTP {state.httpResponse.status} {state.httpResponse.statusText}
          </p>
        )}

        {(hasTimeline || hasBody) && (
          <div
            onClick={handleOutputClick}
            className="bg-muted/30 rounded-lg p-3 text-sm"
          >
            {hasTimeline && (
              <ResponseTimeline
                reasoning={reasoning || undefined}
                activeToolCalls={state?.toolCalls}
              />
            )}
            {hasBody && (
              <AssistantMessageBody
                messageArtifacts={messageArtifacts}
                messageDownloads={[]}
                content={content}
                isCanvasOpen={isSelected}
                activeArtifactId={isSelected ? state?.artifact?.id : null}
                onToggleArtifact={onClick}
                createdAt={state?.completedAt}
              />
            )}
          </div>
        )}

        {state?.errorMessage && (
          <p className="text-destructive text-xs">{state.errorMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}
