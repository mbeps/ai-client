import {
  isStepCount,
  readUIMessageStream,
  ToolLoopAgent,
  tool,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { getLogger } from "@/lib/logger";
import { constructSubagentPrompt } from "@/lib/subagents/construct-subagent-prompt";
import { getSubagentTools } from "@/lib/subagents/get-subagent-tools";
import { sanitizeSubagentOutput } from "@/lib/subagents/subagent-dispatch-tool";
import { SUBAGENT_ROLES } from "@/lib/subagents/subagent-role";

const log = getLogger(["subagents", "dispatch"]);

/**
 * Represents create subagent dispatch tool params.
 *
 * @author Maruf Bepary
 */
interface CreateSubagentDispatchToolParams {
  defaultModel: any;
  customWorkerModel?: any;
  availableTools: Record<string, any>;
  maxSteps?: number;
}

/**
 * Creates the `delegate_task` tool for the orchestrator agent. Streams incremental worker updates to the UI via generator yielding (`readUIMessageStream`) and returns a concise, structured summary to the orchestrator model via `toModelOutput`.
 *
 * @param params - Target params
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function createSubagentDispatchTool(
  params: CreateSubagentDispatchToolParams,
) {
  const {
    defaultModel,
    customWorkerModel,
    availableTools,
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
      const workerTools = getSubagentTools(availableTools);

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
