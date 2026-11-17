import {
  isStepCount,
  readUIMessageStream,
  ToolLoopAgent,
  tool,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { DEFAULT_LINKABLE_BUILT_IN_AGENTS } from "@/config/built-in-agents";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { getLogger } from "@/lib/logger";
import { sanitiseToolName } from "@/lib/mcp/sanitise-tool-names";
import { constructSubagentPrompt } from "@/lib/subagents/construct-subagent-prompt";
import { getSubagentTools } from "@/lib/subagents/get-subagent-tools";
import { registerScratchpadTools } from "@/lib/subagents/register-subagent-tools";
import { sanitizeSubagentOutput } from "@/lib/subagents/subagent-dispatch-tool";
import { SUBAGENT_ROLES } from "@/lib/subagents/subagent-role";
import type { Agent } from "@/types/agent/agent";

const log = getLogger(["subagents", "dispatch"]);

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
  resolveModelById?: (modelId: string) => Promise<any> | any;
  buildIsolatedTools?: (
    agent: Agent,
  ) => Promise<Record<string, any>> | Record<string, any>;
  buildKnowledgebaseTools?: (
    kbIds: string[],
  ) => Promise<Record<string, any>> | Record<string, any>;
}

/**
 * Resolves the target subagent from `allowedSubagents` by checking `agentIdentifier`
 * first and falling back to `roleAlias` if `agentIdentifier` is absent or unmatched.
 *
 * @param allowedSubagents - Linked subagents permitted for this turn
 * @param agentIdentifier - Optional target agent ID, built-in slug, or name
 * @param roleAlias - Optional built-in role alias fallback
 * @returns Matching `Agent` or `undefined` if none match
 * @author Maruf Bepary
 */
export function resolveTargetAgent(
  allowedSubagents: readonly Agent[],
  agentIdentifier?: string,
  roleAlias?: string,
): Agent | undefined {
  const candidates = [agentIdentifier?.trim(), roleAlias?.trim()].filter(
    (v): v is string => Boolean(v),
  );

  for (const query of candidates) {
    const lower = query.toLowerCase();
    const builtInId = lower.startsWith("builtin:") ? lower : `builtin:${lower}`;

    const matched = allowedSubagents.find(
      (candidate) =>
        candidate.id === query ||
        candidate.id === builtInId ||
        candidate.name.toLowerCase() === lower,
    );
    if (matched) {
      return matched;
    }
  }

  return undefined;
}

/**
 * Filters a pool of runtime tools down to those explicitly configured on an isolated subagent.
 * Normalizes MCP tool identifiers (`<serverId>:tool:<toolName>`) against both raw and
 * provider-sanitised tool names so special characters (`.` or `:`) match `registerMcpTools` keys.
 *
 * @param availableTools - Pool of available runtime tool instances
 * @param configuredTools - Tool identifiers configured on the target subagent
 * @param knowledgebaseIds - Optional knowledge base IDs attached to the subagent
 * @returns Filtered dictionary of runtime tools permitted for the subagent
 * @author Maruf Bepary
 */
export function filterToolsForAgent(
  availableTools: Record<string, any>,
  configuredTools: readonly string[],
  knowledgebaseIds?: readonly string[],
): Record<string, any> {
  const allowedRuntimeNames = new Set<string>();
  for (const entry of configuredTools) {
    const runtimeName =
      INTERNAL_TOOL_ID_TO_RUNTIME_NAME[entry] ??
      (entry.includes(":tool:") ? entry.split(":tool:")[1] : entry);
    if (runtimeName) {
      allowedRuntimeNames.add(runtimeName);
      allowedRuntimeNames.add(sanitiseToolName(runtimeName));
    }
  }
  if (knowledgebaseIds && knowledgebaseIds.length > 0) {
    allowedRuntimeNames.add("search_knowledge_base");
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
    buildKnowledgebaseTools,
  } = params;

  const availableAgentsDesc =
    allowedSubagents.length > 0
      ? allowedSubagents.map((a) => `${a.name} (id: "${a.id}")`).join(", ")
      : "none";

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
          `Target subagent ID or exact name. Available subagents: ${availableAgentsDesc}. Always pass the target subagent's ID or name here when delegating to a custom subagent.`,
        ),
      role: z
        .enum(SUBAGENT_ROLES)
        .optional()
        .describe(
          "Optional built-in role alias ('researcher', 'planner', 'reviewer', or 'worker'). Only use when delegating to a built-in role agent; for custom subagents, pass their ID or name in 'agent'.",
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
        (targetAgent.modelId &&
          (await resolveModelById?.(targetAgent.modelId))) ||
        customWorkerModel ||
        defaultModel;

      const {
        maxSteps: rawMaxSteps,
        scratchpadAccess,
        isolateTools,
      } = targetAgent.guardrails;
      const effectiveMaxSteps = Math.min(Math.max(rawMaxSteps, 1), 30);

      const baseFilteredTools = isolateTools
        ? buildIsolatedTools
          ? await buildIsolatedTools(targetAgent)
          : filterToolsForAgent(
              availableTools,
              targetAgent.tools,
              targetAgent.knowledgebaseIds,
            )
        : availableTools;

      const targetKbIds = targetAgent.knowledgebaseIds;
      const agentKbTools =
        targetKbIds.length > 0 && buildKnowledgebaseTools
          ? await buildKnowledgebaseTools(targetKbIds)
          : {};
      const rawWorkerTools = { ...baseFilteredTools, ...agentKbTools };

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
