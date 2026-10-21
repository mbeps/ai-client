import type { ArtifactData } from "@/types/artifact/artifact-data";

/**
 * Tool call entry representing an MCP or system tool execution during a transform step.
 */
export interface ToolCall {
  toolCallId: string;
  toolName: string;
  serverName?: string;
  args: unknown;
}

/**
 * Tool result entry containing the execution output from an MCP or system tool.
 */
export interface ToolResult {
  toolCallId: string;
  toolName: string;
  serverName?: string;
  result: unknown;
}

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
