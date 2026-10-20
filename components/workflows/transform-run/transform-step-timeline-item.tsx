import { CheckCircle2, Circle, Clock, Loader2 } from "lucide-react";
import { ToolCallDisplay } from "@/components/chat/message/tool-call-display";
import { Badge } from "@/components/ui/badge";
import type { TransformStep } from "@/types/transform/transform-step";
import type {
  StepState,
  ToolCall,
  ToolResult,
} from "@/types/workflows/transform-run";

const STEP_ICON_STATUS_CLASSES: Record<StepState["status"], string> = {
  completed: "border border-green-500 bg-green-50/50 text-green-500",
  running:
    "animate-pulse border border-blue-500 text-blue-500 ring-4 ring-blue-500/10",
  awaiting_review: "border border-amber-500 bg-amber-50/50 text-amber-500",
  pending: "border text-muted-foreground",
};

const STEP_DEFAULT_SUMMARIES: Record<StepState["status"], string> = {
  completed: "Step completed successfully.",
  running: "AI is working on your request...",
  awaiting_review: "Waiting for your review...",
  pending: "Scheduled for execution.",
};

function StepTimelineIcon({ status }: { status: StepState["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "awaiting_review":
      return <Clock className="h-4 w-4" />;
    default:
      return <Circle className="h-4 w-4" />;
  }
}

function resolveIconContainerClass(
  status: StepState["status"],
  isSelected: boolean,
): string {
  const base =
    "absolute top-3 left-0 z-10 flex h-8 w-8 items-center justify-center rounded-full border-muted-foreground/10 bg-background shadow-sm transition-all";
  const statusClass =
    STEP_ICON_STATUS_CLASSES[status] ?? "border text-muted-foreground";
  const selectedClass = isSelected ? "shadow-md ring-2 ring-primary/20" : "";
  return `${base} ${statusClass} ${selectedClass}`.trim();
}

function resolveStepSummary(
  status: StepState["status"],
  summary?: string,
): string {
  if (status === "completed" && summary) {
    return summary;
  }
  return STEP_DEFAULT_SUMMARIES[status] ?? "Scheduled for execution.";
}

function StepToolCalls({
  toolCalls,
  toolResults,
}: {
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="mt-2" onClick={(e) => e.stopPropagation()}>
      <ToolCallDisplay toolCalls={toolCalls} toolResults={toolResults || []} />
    </div>
  );
}

interface StepTimelineContentProps {
  name: string;
  isCompleted: boolean;
  isSelected: boolean;
  summaryText: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

function StepTimelineContent({
  name,
  isCompleted,
  isSelected,
  summaryText,
  toolCalls,
  toolResults,
}: StepTimelineContentProps) {
  const containerClass = isSelected
    ? "translate-x-1 border-primary/20 bg-primary/5 shadow-sm"
    : "border-transparent bg-transparent hover:bg-muted/30";

  return (
    <div className={`rounded-xl border p-4 transition-all ${containerClass}`}>
      <div className="mb-1 flex items-center gap-2">
        <h4 className={`font-bold text-sm ${isSelected ? "text-primary" : ""}`}>
          {name}
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

      <StepToolCalls toolCalls={toolCalls} toolResults={toolResults} />

      <p className="mt-2 line-clamp-2 text-muted-foreground text-xs">
        {summaryText}
      </p>
    </div>
  );
}

export interface TransformStepTimelineItemProps {
  step: TransformStep;
  index: number;
  state: StepState;
  isSelected: boolean;
  onSelect: (index: number) => void;
}

/**
 * Visual timeline item representing a single workflow step in execution.
 */
export function TransformStepTimelineItem({
  step,
  index,
  state,
  isSelected,
  onSelect,
}: TransformStepTimelineItemProps) {
  const isCompleted = state.status === "completed";
  const isAwaiting = state.status === "awaiting_review";
  const isClickable = isCompleted || isAwaiting;

  const iconClass = resolveIconContainerClass(state.status, isSelected);
  const summaryText = resolveStepSummary(state.status, state.summary);

  return (
    <div
      className={`group relative pb-6 pl-10 transition-all duration-200 last:pb-0 ${
        isClickable ? "cursor-pointer" : "opacity-60"
      }`}
      onClick={() => {
        if (isClickable) onSelect(index);
      }}
    >
      <div className={iconClass}>
        <StepTimelineIcon status={state.status} />
      </div>

      <StepTimelineContent
        name={step.name}
        isCompleted={isCompleted}
        isSelected={isSelected}
        summaryText={summaryText}
        toolCalls={state.toolCalls}
        toolResults={state.toolResults}
      />
    </div>
  );
}
