import {
  isStepCount,
  readUIMessageStream,
  ToolLoopAgent,
  tool,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { getLogger } from "@/lib/logger";

const log = getLogger(["subagents", "dispatch"]);

export const SUBAGENT_ROLES = [
  "researcher",
  "planner",
  "reviewer",
  "worker",
] as const;
export type SubagentRole = (typeof SUBAGENT_ROLES)[number];

export interface SubagentExecutionMetadata {
  isSubagent: true;
  agentRole: SubagentRole;
  parentInvocationId: string;
  runId: string;
  allocatedModel: string;
}

/**
 * Filter tools to guarantee the 2-layer architectural boundary:
 * 1. `delegate_task` is strictly omitted to prevent subagents from calling subagents.
 * 2. `manage_artifact` is strictly omitted to protect the user canvas from partial worker drafts.
 * 3. Any user-specified excluded tools are also stripped.
 */
export function getSubagentTools(
  availableTools: Record<string, any>,
  userExcludedTools: string[] = [],
): Record<string, any> {
  const forbidden = new Set([
    "delegate_task",
    "subagent_dispatch",
    "manage_artifact",
    INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    ...userExcludedTools,
  ]);

  const sanitized: Record<string, any> = {};
  for (const [name, toolInstance] of Object.entries(availableTools)) {
    if (!forbidden.has(name)) {
      sanitized[name] = toolInstance;
    }
  }
  return sanitized;
}

export function constructSubagentPrompt(
  metadata: SubagentExecutionMetadata,
): string {
  return `
[SYSTEM IDENTITY: ISOLATED WORKER SUBAGENT]
Role: ${metadata.agentRole.toUpperCase()}
Execution Mode: Layer 1 Worker
Topological Constraints:
1. You are operating as an isolated subagent under an orchestrating agent.
2. You cannot spawn subordinate agents (depth limit d=1).
3. You cannot manipulate the user's canvas or create artifacts directly.
4. Use scratchpad_write to store intermediate findings, extensive document extracts, structured outlines, or tables for peer access and user inspection.
5. Conclude your work with a clear, self-contained summary adhering to your reporting contract.

REPORTING CONTRACT:
Provide your final text response starting with one of these exact status indicators:
- STATUS: DONE - when the task is completely finished.
- STATUS: DONE_WITH_CONCERNS - when completed, but ambiguities or risks were identified.
- STATUS: NEEDS_CONTEXT - when vital information is missing and could not be found with tools.
- STATUS: BLOCKED - when contradictions or tool errors prevent completion.

Follow the status with a concise summary (under 500 words) of your conclusions and any scratchpad file paths created.
`.trim();
}

export interface CreateSubagentDispatchToolParams {
  defaultModel: any;
  customWorkerModel?: any;
  availableTools: Record<string, any>;
  excludedTools?: string[];
  maxSteps?: number;
}

/**
 * Extracts a concise text summary from a subagent's execution output.
 * Handles strings, UIMessage objects, structured results, and text parts.
 */
export function extractSubagentSummary(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }
  if (!output || typeof output !== "object") {
    return "Subagent finished with no text output.";
  }
  const r = output as Record<string, unknown>;
  if (typeof r.summary === "string" && r.summary.trim()) {
    return r.summary;
  }
  if (typeof r.value === "string" && r.value.trim()) {
    return r.value;
  }
  if (typeof r.text === "string" && r.text.trim()) {
    return r.text;
  }
  if (Array.isArray(r.parts)) {
    const textParts = (r.parts as Array<{ type?: string; text?: string }>)
      .filter(
        (p) =>
          p?.type === "text" && typeof p?.text === "string" && p.text.trim(),
      )
      .map((p) => p.text as string);
    if (textParts.length > 0) {
      const lastText = textParts[textParts.length - 1];
      if (
        lastText &&
        (lastText.includes("STATUS:") || textParts.length === 1)
      ) {
        return lastText;
      }
      return textParts.join("\n\n");
    }
  }
  return "Subagent finished with no text output.";
}

/**
 * Bounds subagent output to avoid context window bloat (default: 8,000 chars / ~2,000 tokens).
 */
export function sanitizeSubagentOutput(
  output: unknown,
  maxChars = 8000,
): string {
  const text = extractSubagentSummary(output);
  if (text.length > maxChars) {
    return (
      text.slice(0, maxChars) +
      "\n\n[... Output truncated to 8,000 characters for context efficiency. Full details are stored in the scratchpad.]"
    );
  }
  return text;
}

/**
 * Creates the `delegate_task` tool for the orchestrator agent.
 *
 * Streams incremental worker updates to the UI via generator yielding (`readUIMessageStream`)
 * and returns a concise, structured summary to the orchestrator model via `toModelOutput`.
 *
 * @author Maruf Bepary
 */
export function createSubagentDispatchTool(
  params: CreateSubagentDispatchToolParams,
) {
  const {
    defaultModel,
    customWorkerModel,
    availableTools,
    excludedTools = [],
    maxSteps = 10,
  } = params;

  return tool({
    description:
      "Delegates an isolated, complex, or context-heavy task to a specialized worker subagent. " +
      "Use this for deep document analysis, comprehensive planning, code review, or multi-step exploration. " +
      "The subagent operates in an isolated context and has access to scratchpad tools to persist notes. " +
      "Do NOT use this for trivial single-turn questions.",
    inputSchema: z.object({
      role: z
        .enum(SUBAGENT_ROLES)
        .describe(
          "Specialised role for the subagent: 'researcher', 'planner', 'reviewer', or 'worker'.",
        ),
      taskBrief: z
        .string()
        .describe(
          "Complete, self-contained requirements and instructions for the task.",
        ),
      inputData: z
        .string()
        .optional()
        .describe(
          "Optional context pointers, specific queries, or references to scratchpad files.",
        ),
    }),
    execute: async function* ({ role, taskBrief, inputData }, { abortSignal }) {
      const selectedModel = customWorkerModel ?? defaultModel;
      const workerTools = getSubagentTools(availableTools, excludedTools);

      const runId = crypto.randomUUID();
      const parentInvocationId = crypto.randomUUID();

      log.info("Dispatching subagent (role: {role}, runId: {runId})", {
        role,
        runId,
      });

      try {
        const workerAgent = new ToolLoopAgent({
          model: selectedModel,
          instructions: constructSubagentPrompt({
            isSubagent: true,
            agentRole: role,
            parentInvocationId,
            runId,
            allocatedModel:
              typeof selectedModel === "object" && selectedModel?.modelId
                ? selectedModel.modelId
                : "worker-model",
          }),
          tools: workerTools,
          stopWhen: isStepCount(maxSteps),
        });

        const streamResult = await workerAgent.stream({
          prompt: `TASK BRIEF:\n${taskBrief}\n\nINPUT DATA:\n${inputData ?? "None provided."}`,
          abortSignal,
        });

        // Stream each incremental UI message chunk to the frontend
        for await (const uiChunk of readUIMessageStream({
          stream: toUIMessageStream({ stream: streamResult.stream }),
        })) {
          yield uiChunk;
        }
      } catch (err) {
        log.error("Subagent execution failed (role: {role}, runId: {runId})", {
          role,
          runId,
          error: err instanceof Error ? err.message : String(err),
        });
        const errorMessage =
          err instanceof Error ? err.message : "Subagent worker failed";
        yield {
          id: runId,
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `STATUS: BLOCKED - Worker execution failed: ${errorMessage}`,
            },
          ],
        } as any;
      }
    },
    toModelOutput: ({ output }: { output: any }) => {
      return {
        type: "text",
        value: sanitizeSubagentOutput(output),
      };
    },
  });
}
