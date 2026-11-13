import {
  isStepCount,
  readUIMessageStream,
  ToolLoopAgent,
  tool,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import {
  BUILT_IN_AGENTS,
  isLinkableBuiltInAgentId,
} from "@/config/built-in-agents";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { getLogger } from "@/lib/logger";
import { constructSubagentPrompt } from "@/lib/subagents/construct-subagent-prompt";
import { getSubagentTools } from "@/lib/subagents/get-subagent-tools";
import { registerScratchpadTools } from "@/lib/subagents/register-subagent-tools";
import { sanitizeSubagentOutput } from "@/lib/subagents/subagent-dispatch-tool";
import { SUBAGENT_ROLES } from "@/lib/subagents/subagent-role";
import type { Agent } from "@/types/agent/agent";

const log = getLogger(["subagents", "dispatch"]);

const DEFAULT_LINKABLE_BUILT_IN_AGENTS = BUILT_IN_AGENTS.filter((a) =>
  isLinkableBuiltInAgentId(a.id),
);

const INTERNAL_TOOL_ID_TO_RUNTIME_NAME: Record<string, string> = {
  [INTERNAL_TOOL_IDS.SEARCH_KNOWLEDGE_BASE]: "search_knowledge_base",
  [INTERNAL_TOOL_IDS.MANAGE_MEMORY]: "save_memory",
};

/**
 * Parameters for creating the unified `delegate_task` dispatch tool.
 *
 * @author Maruf Bepary
 */
export interface CreateSubagentDispatchToolParams {
  defaultModel: any;
  customWorkerModel?: any;
  availableTools: Record<string, any>;
  maxSteps?: number;
  scratchpadContext?: { chatId: string; messageId: string };
  allowedSubagents?: readonly Agent[];
  resolveModelById?: (modelId: string) => any;
  buildIsolatedTools?: (
    agent: Agent,
  ) => Promise<Record<string, any>> | Record<string, any>;
}

function resolveTargetAgent(
  allowedSubagents: readonly Agent[],
  agentIdentifier?: string,
  roleAlias?: string,
): Agent | undefined {
  const query = agentIdentifier?.trim() || roleAlias?.trim();
  if (!query) {
    return undefined;
  }

  const lower = query.toLowerCase();
  const builtInId = lower.startsWith("builtin:") ? lower : `builtin:${lower}`;

  return allowedSubagents.find(
    (candidate) =>
      candidate.id === query ||
      candidate.id === builtInId ||
      candidate.name.toLowerCase() === lower,
  );
}

function filterToolsForAgent(
  availableTools: Record<string, any>,
  configuredTools: readonly string[],
): Record<string, any> {
  const allowedRuntimeNames = new Set<string>();
  for (const entry of configuredTools) {
    const runtimeName =
      INTERNAL_TOOL_ID_TO_RUNTIME_NAME[entry] ??
      (entry.includes(":tool:") ? entry.split(":tool:")[1] : entry);
    if (runtimeName) {
      allowedRuntimeNames.add(runtimeName);
    }
  }

  const filtered: Record<string, any> = {};
  for (const [name, toolInstance] of Object.entries(availableTools)) {
    if (allowedRuntimeNames.has(name)) {
      filtered[name] = toolInstance;
    }
  }
  return filtered;
}

function createBlockedChunk(runId: string, message: string) {
  return {
    id: runId,
    role: "assistant",
    parts: [{ type: "text", text: `STATUS: BLOCKED - ${message}` }],
  } as any;
}

/**
 * Creates the `delegate_task` tool for the orchestrator agent.
 * Resolves the target subagent against `allowedSubagents`, enforces its guardrails
 * (`maxSteps`, `scratchpadAccess`, `isolateTools`, `modelId`), streams UI chunks,
 * and returns a bounded summary via `toModelOutput`.
 *
 * @param params - Dispatch tool configuration
 * @returns Configured AI SDK tool
 * @author Maruf Bepary
 */
export function createSubagentDispatchTool(
  params: CreateSubagentDispatchToolParams,
) {
  const {
    defaultModel,
    customWorkerModel,
    availableTools,
    scratchpadContext,
    allowedSubagents = DEFAULT_LINKABLE_BUILT_IN_AGENTS,
    resolveModelById,
    buildIsolatedTools,
  } = params;

  return tool({
    description:
      "Delegates an isolated, complex, or context-heavy task to a specialized worker subagent. " +
      "Use this for deep document analysis, comprehensive planning, code review, or multi-step exploration. " +
      "The subagent operates in an isolated context and has access to scratchpad tools to persist notes. " +
      "Do NOT use this for trivial single-turn questions.",
    inputSchema: z.object({
      agent: z
        .string()
        .optional()
        .describe(
          "Target subagent ID (e.g. 'builtin:researcher' or agent UUID), name, or role slug.",
        ),
      role: z
        .enum(SUBAGENT_ROLES)
        .optional()
        .describe(
          "Optional built-in role alias: 'researcher', 'planner', 'reviewer', or 'worker'.",
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
    execute: async function* (
      { agent, role, taskBrief, inputData },
      { abortSignal },
    ) {
      const runId = crypto.randomUUID();
      const targetAgent = resolveTargetAgent(allowedSubagents, agent, role);

      if (!targetAgent) {
        const availableList = allowedSubagents
          .map((a) => `${a.name} (${a.id})`)
          .join(", ");
        yield createBlockedChunk(
          runId,
          `Requested subagent "${agent ?? role ?? "none"}" is not linked or available. Available subagents: ${availableList || "none"}.`,
        );
        return;
      }

      const selectedModel =
        (targetAgent.modelId && resolveModelById?.(targetAgent.modelId)) ||
        customWorkerModel ||
        defaultModel;

      const {
        maxSteps: rawMaxSteps,
        scratchpadAccess,
        isolateTools,
      } = targetAgent.guardrails;
      const effectiveMaxSteps = Math.min(Math.max(rawMaxSteps, 1), 30);

      const rawWorkerTools = isolateTools
        ? buildIsolatedTools
          ? await buildIsolatedTools(targetAgent)
          : filterToolsForAgent(availableTools, targetAgent.tools)
        : availableTools;

      const baseWorkerTools = getSubagentTools(rawWorkerTools);
      const workerRoleLabel = targetAgent.isBuiltIn
        ? targetAgent.id.replace("builtin:", "")
        : targetAgent.name;

      const workerTools = scratchpadContext
        ? {
            ...baseWorkerTools,
            ...registerScratchpadTools({
              chatId: scratchpadContext.chatId,
              messageId: scratchpadContext.messageId,
              workerRole: workerRoleLabel,
              scratchpadAccess,
            }),
          }
        : baseWorkerTools;

      const parentInvocationId = crypto.randomUUID();

      log.info(
        "Dispatching subagent (agent: {agentId}, role: {role}, runId: {runId})",
        {
          agentId: targetAgent.id,
          role: workerRoleLabel,
          runId,
        },
      );

      try {
        const workerAgent = new ToolLoopAgent({
          model: selectedModel,
          instructions: constructSubagentPrompt({
            isSubagent: true,
            agentRole: workerRoleLabel,
            agent: targetAgent,
            parentInvocationId,
            runId,
            allocatedModel:
              typeof selectedModel === "object" && selectedModel?.modelId
                ? selectedModel.modelId
                : "worker-model",
            scratchpadAccess,
          }),
          tools: workerTools,
          stopWhen: isStepCount(effectiveMaxSteps),
        });

        const streamResult = await workerAgent.stream({
          prompt: `TASK BRIEF:\n${taskBrief}\n\nINPUT DATA:\n${inputData ?? "None provided."}`,
          abortSignal,
        });

        let lastYieldTime = -Infinity;
        let lastChunk: any = null;
        let hasPendingUnyieldedChunk = false;

        // Stream each incremental UI message chunk to the frontend, throttled to 150ms
        for await (const uiChunk of readUIMessageStream({
          stream: toUIMessageStream({ stream: streamResult.stream }),
        })) {
          lastChunk = uiChunk;
          const now = Date.now();
          if (now - lastYieldTime >= 150) {
            lastYieldTime = now;
            hasPendingUnyieldedChunk = false;
            yield uiChunk;
          } else {
            hasPendingUnyieldedChunk = true;
          }
        }

        if (hasPendingUnyieldedChunk && lastChunk) {
          yield lastChunk;
        }
      } catch (err) {
        log.error(
          "Subagent execution failed (agent: {agentId}, runId: {runId})",
          {
            agentId: targetAgent.id,
            runId,
            error: err instanceof Error ? err.message : String(err),
          },
        );
        const errorMessage =
          err instanceof Error ? err.message : "Subagent worker failed";
        yield createBlockedChunk(
          runId,
          `Worker execution failed: ${errorMessage}`,
        );
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
