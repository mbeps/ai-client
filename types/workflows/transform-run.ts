import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { ToolCall } from "@/types/chat/tool-call";
import type { ToolResult } from "@/types/chat/tool-result";

export type { ToolCall, ToolResult };

/**
 * Runtime execution state for an individual transform agent step during a workflow run.
 */
export interface StepState {
  status: "pending" | "running" | "completed" | "awaiting_review";
  summary?: string;
  stepData?: Record<string, any[]>;
  artifact?: ArtifactData | null;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  outputAttachmentId?: string;
}
