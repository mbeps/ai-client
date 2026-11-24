import {
  isStepCount,
  readUIMessageStream,
  streamText,
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

const SCRATCHPAD_TOOL_NAMES = new Set([
  "scratchpad_write",
  "scratchpad_read",
  "scratchpad_list",
]);

/** Server identity maps for disambiguating same-named MCP tools across servers. */
export interface ToolIdentityMaps {
  toolServerIdMap?: Record<string, string>;
  toolSourceMap?: Record<string, string>;
}

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
  resolveModelById?: (
    modelId: string,
    reasoningEffort?: string | null,
  ) => Promise<any> | any;
  buildIsolatedTools?: (
    agent: Agent,
  ) => Promise<Record<string, any>> | Record<string, any>;
  buildKnowledgebaseTools?: (
    kbIds: string[],
  ) => Promise<Record<string, any>> | Record<string, any>;
  wrapSubagentTools?: (
    workerTools: Record<string, any>,
    targetAgent: Agent,
  ) => Record<string, any>;
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

    const idMatch = allowedSubagents.find(
      (candidate) => candidate.id === query || candidate.id === builtInId,
    );
    if (idMatch) {
      return idMatch;
    }

    const nameMatch = allowedSubagents.find(
      (candidate) => candidate.name.toLowerCase() === lower,
    );
    if (nameMatch) {
      return nameMatch;
    }
  }

  return undefined;
}

function matchesSanitisedName(
  runtimeName: string,
  rawName: string,
  sanitisedName: string,
): boolean {
  if (runtimeName === rawName || runtimeName === sanitisedName) {
    return true;
  }
  const suffixMatch = runtimeName.match(/^(.+)(_\d+)$/);
  if (!suffixMatch) return false;
  const [, prefix, suffix] = suffixMatch;
  const maxPrefixLen = Math.max(1, 64 - suffix.length);
  return prefix === sanitisedName.slice(0, maxPrefixLen);
}

/**
 * Filters a pool of runtime tools down to those explicitly configured on an isolated subagent.
 * Normalizes MCP tool identifiers (`<serverId>:tool:<toolName>`) against both raw and
 * provider-sanitised tool names while enforcing server identity when identity maps are provided.
 *
 * @param availableTools - Pool of available runtime tool instances
 * @param configuredTools - Tool identifiers configured on the target subagent
 * @param knowledgebaseIds - Optional knowledge base IDs attached to the subagent
 * @param toolIdentity - Optional server ID/name maps for cross-server disambiguation
 * @returns Filtered dictionary of runtime tools permitted for the subagent
 * @author Maruf Bepary
 */
export function filterToolsForAgent(
  availableTools: Record<string, any>,
  configuredTools: readonly string[],
  knowledgebaseIds?: readonly string[],
  toolIdentity?: ToolIdentityMaps,
): Record<string, any> {
  const hasServerIdentityMaps = Boolean(
    toolIdentity?.toolServerIdMap || toolIdentity?.toolSourceMap,
  );
  const serverEntries: Array<{
    server: string;
    rawName: string;
    sanitisedName: string;
  }> = [];
  const allowedUnscopedNames = new Set<string>();

  for (const entry of configuredTools) {
    const internalRuntime = INTERNAL_TOOL_ID_TO_RUNTIME_NAME[entry];
    if (internalRuntime) {
      allowedUnscopedNames.add(internalRuntime);
      allowedUnscopedNames.add(sanitiseToolName(internalRuntime));
      continue;
    }
    const sepIdx = entry.indexOf(":tool:");
    if (sepIdx !== -1) {
      const server = entry.slice(0, sepIdx);
      const rawName = entry.slice(sepIdx + 6);
      if (rawName) {
        serverEntries.push({
          server,
          rawName,
          sanitisedName: sanitiseToolName(rawName),
        });
      }
      continue;
    }
    if (entry) {
      allowedUnscopedNames.add(entry);
      allowedUnscopedNames.add(sanitiseToolName(entry));
    }
  }
  if (knowledgebaseIds && knowledgebaseIds.length > 0) {
    allowedUnscopedNames.add("search_knowledge_base");
  }

  const filtered: Record<string, any> = {};
  for (const [name, toolInstance] of Object.entries(availableTools)) {
    if (allowedUnscopedNames.has(name)) {
      filtered[name] = toolInstance;
      continue;
    }
    const matchedServerEntry = serverEntries.some(
      ({ server, rawName, sanitisedName }) => {
        if (!matchesSanitisedName(name, rawName, sanitisedName)) {
          return false;
        }
        if (!hasServerIdentityMaps) {
          return true;
        }
        const actualServerId = toolIdentity?.toolServerIdMap?.[name];
        const actualServerName = toolIdentity?.toolSourceMap?.[name];
        return actualServerId === server || actualServerName === server;
      },
    );
    if (matchedServerEntry) {
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

interface SubagentUsageSummary {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

function normalizeUsage(raw: any): SubagentUsageSummary | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const promptTokens =
    typeof raw.promptTokens === "number"
      ? raw.promptTokens
      : typeof raw.inputTokens === "number"
        ? raw.inputTokens
        : undefined;
  const completionTokens =
    typeof raw.completionTokens === "number"
      ? raw.completionTokens
      : typeof raw.outputTokens === "number"
        ? raw.outputTokens
        : undefined;
  const totalTokens =
    typeof raw.totalTokens === "number"
      ? raw.totalTokens
      : promptTokens !== undefined && completionTokens !== undefined
        ? promptTokens + completionTokens
        : undefined;
  if (
    promptTokens === undefined &&
    completionTokens === undefined &&
    totalTokens === undefined
  ) {
    return undefined;
  }
  return { promptTokens, completionTokens, totalTokens };
}

function mergeUsage(
  a?: SubagentUsageSummary,
  b?: SubagentUsageSummary,
): SubagentUsageSummary | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    promptTokens: (a.promptTokens ?? 0) + (b.promptTokens ?? 0),
    completionTokens: (a.completionTokens ?? 0) + (b.completionTokens ?? 0),
    totalTokens: (a.totalTokens ?? 0) + (b.totalTokens ?? 0),
  };
}

function hasNonEmptyTextPart(chunk: any): boolean {
  if (!chunk || !Array.isArray(chunk.parts)) return false;
  return chunk.parts.some(
    (p: any) =>
      p?.type === "text" && typeof p.text === "string" && p.text.trim() !== "",
  );
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
          (await (targetAgent.reasoningEffort
            ? resolveModelById?.(
                targetAgent.modelId,
                targetAgent.reasoningEffort,
              )
            : resolveModelById?.(targetAgent.modelId)))) ||
        customWorkerModel ||
        defaultModel;

      const {
        maxSteps: rawMaxSteps,
        scratchpadAccess,
        isolateTools,
      } = targetAgent.guardrails;
      const effectiveMaxSteps = Math.min(Math.max(rawMaxSteps, 1), 30);

      const isolatedAgentTools = buildIsolatedTools
        ? await buildIsolatedTools(targetAgent)
        : filterToolsForAgent(
            availableTools,
            targetAgent.tools,
            targetAgent.knowledgebaseIds,
          );
      const baseFilteredTools = isolateTools
        ? isolatedAgentTools
        : { ...availableTools, ...isolatedAgentTools };

      const targetKbIds = targetAgent.knowledgebaseIds;
      const agentKbTools =
        targetKbIds.length > 0 && buildKnowledgebaseTools
          ? await buildKnowledgebaseTools(targetKbIds)
          : {};
      const rawWorkerTools = { ...baseFilteredTools, ...agentKbTools };

      const baseWorkerTools = Object.fromEntries(
        Object.entries(getSubagentTools(rawWorkerTools)).filter(
          ([name]) => !SCRATCHPAD_TOOL_NAMES.has(name),
        ),
      );
      const workerRoleLabel = targetAgent.isBuiltIn
        ? targetAgent.id.replace("builtin:", "")
        : targetAgent.name;

      const baseFinalWorkerTools = scratchpadContext
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

      const workerTools = params.wrapSubagentTools
        ? params.wrapSubagentTools(baseFinalWorkerTools, targetAgent)
        : baseFinalWorkerTools;

      const parentInvocationId = crypto.randomUUID();

      log.info(
        "Dispatching subagent (agent: {agentId}, role: {role}, runId: {runId})",
        {
          agentId: targetAgent.id,
          role: workerRoleLabel,
          runId,
        },
      );

      const startTime = Date.now();
      const allocatedModelId =
        typeof selectedModel === "object" && selectedModel?.modelId
          ? String(selectedModel.modelId)
          : "worker-model";
      const instructions = constructSubagentPrompt({
        isSubagent: true,
        agentRole: workerRoleLabel,
        agent: targetAgent,
        parentInvocationId,
        runId,
        allocatedModel: allocatedModelId,
        scratchpadAccess,
      });
      const workerPrompt = `TASK BRIEF:\n${taskBrief}\n\nINPUT DATA:\n${inputData ?? "None provided."}`;

      try {
        const workerAgent = new ToolLoopAgent({
          model: selectedModel,
          instructions,
          tools: workerTools,
          stopWhen: isStepCount(effectiveMaxSteps),
        });

        const streamResult = await workerAgent.stream({
          prompt: workerPrompt,
          abortSignal,
        });

        let lastYieldTime = -Infinity;
        let lastChunk: any = null;

        // Stream each incremental UI message chunk to the frontend, throttled to 150ms
        for await (const uiChunk of readUIMessageStream({
          stream: toUIMessageStream({
            stream: streamResult.stream,
            tools: workerTools,
            sendReasoning: true,
            sendSources: true,
          }),
        })) {
          lastChunk = uiChunk;
          const now = Date.now();
          if (now - lastYieldTime >= 150) {
            lastYieldTime = now;
            yield uiChunk;
          }
        }

        const [
          workerUsageRaw,
          workerFinishReason,
          workerSteps,
          workerResponse,
        ] = await Promise.all([
          Promise.resolve(streamResult.totalUsage).catch(() => undefined),
          Promise.resolve(streamResult.finishReason).catch(() => undefined),
          Promise.resolve(streamResult.steps).catch(() => undefined),
          Promise.resolve(streamResult.response).catch(() => undefined),
        ]);

        let totalUsage = normalizeUsage(workerUsageRaw);
        let finalFinishReason =
          typeof workerFinishReason === "string"
            ? workerFinishReason
            : undefined;

        // Fallback synthesis pass when worker executed steps/tools without emitting text
        if (
          !abortSignal?.aborted &&
          lastChunk &&
          !hasNonEmptyTextPart(lastChunk) &&
          Array.isArray(workerResponse?.messages) &&
          workerResponse.messages.length > 0
        ) {
          const synthResult = streamText({
            model: selectedModel,
            system: instructions,
            messages: [
              { role: "user", content: workerPrompt },
              ...workerResponse.messages,
              {
                role: "user",
                content:
                  "You finished tool execution without a final text summary. Provide your final response now following the REPORTING CONTRACT (starting with STATUS: DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, or BLOCKED) summarizing all findings and any scratchpad files written.",
              },
            ],
            abortSignal,
          });

          const baseParts = Array.isArray(lastChunk.parts)
            ? [...lastChunk.parts]
            : [];
          let synthText = "";
          let lastSynthYield = -Infinity;
          for await (const delta of synthResult.textStream) {
            synthText += delta;
            lastChunk = {
              ...lastChunk,
              parts: [
                ...baseParts,
                { type: "text", text: synthText, state: "streaming" },
              ],
            };
            const now = Date.now();
            if (now - lastSynthYield >= 150) {
              lastSynthYield = now;
              yield lastChunk;
            }
          }
          if (synthText.trim()) {
            lastChunk = {
              ...lastChunk,
              parts: [
                ...baseParts,
                { type: "text", text: synthText, state: "done" },
              ],
            };
          }
          const [synthUsageRaw, synthFinish] = await Promise.all([
            Promise.resolve(synthResult.totalUsage).catch(() => undefined),
            Promise.resolve(synthResult.finishReason).catch(() => undefined),
          ]);
          totalUsage = mergeUsage(totalUsage, normalizeUsage(synthUsageRaw));
          if (typeof synthFinish === "string") {
            finalFinishReason = synthFinish;
          }
        }

        if (lastChunk) {
          const stepCount = Array.isArray(workerSteps)
            ? workerSteps.length
            : undefined;
          const finalChunk = {
            ...lastChunk,
            metadata: {
              ...(typeof lastChunk.metadata === "object" && lastChunk.metadata
                ? lastChunk.metadata
                : {}),
              modelId: allocatedModelId,
              durationMs: Date.now() - startTime,
              ...(stepCount !== undefined ? { stepCount } : {}),
              maxSteps: effectiveMaxSteps,
              ...(finalFinishReason ? { finishReason: finalFinishReason } : {}),
              ...(totalUsage ? { usage: totalUsage } : {}),
            },
          };
          yield finalChunk;
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
