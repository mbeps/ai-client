import type { ArtifactData } from "@/types/artifact/artifact-data";

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  serverName?: string;
  args: unknown;
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  serverName?: string;
  result: unknown;
}

export interface StepState {
  status: "pending" | "running" | "completed" | "awaiting_review";
  summary?: string;
  stepData?: Record<string, any[]>;
  artifact?: ArtifactData | null;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  outputAttachmentId?: string;
}
