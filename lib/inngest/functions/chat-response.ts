import { streamText } from "ai";
import { and, eq } from "drizzle-orm";
import { env } from "@/config/env";
import {
  buildToolApproval,
  parseInternalToolApprovals,
} from "@/config/tool-approval";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { db } from "@/drizzle/db";
import { message } from "@/drizzle/schemas/chat-schema";
import { assembleModelMessages } from "@/lib/chat/assemble-model-messages";
import { buildApprovalResumeMessages } from "@/lib/chat/build-approval-resume";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import { chatApprovalRegistry } from "@/lib/chat/chat-approval-registry";
import { compactChatThread } from "@/lib/chat/compact-chat-thread";
import { estimateTokens } from "@/lib/chat/estimate-tokens";
import { extractThreadCanvasArtifacts } from "@/lib/chat/extract-canvas-artifacts";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import {
  persistAssistantResponse,
  updateAssistantResponse,
} from "@/lib/chat/persist-response";
import {
  estimateModelMessageTokens,
  prepareChatMessages,
} from "@/lib/chat/prepare-chat-messages";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { sliceThreadFromLatestCompaction } from "@/lib/chat/slice-thread-from-compaction";
import { buildAssistantFinishMetadata } from "@/lib/chat/stream/build-assistant-finish-metadata";
import { chatChannel } from "@/lib/inngest/chat-channel";
import {
  buildStreamExecutionConfig,
  extractFileAttachments,
  handleChatGenerationError,
  isAbortError,
  loadChatExecutionResources,
  resolveOrchestratorMaxSteps,
  validateModelCapabilities,
} from "@/lib/inngest/chat-response/chat-execution-config";
import type { CompletedToolRecord } from "@/lib/inngest/chat-response/chat-response-types";
import {
  consumeModelStream,
  createStreamEmitter,
} from "@/lib/inngest/chat-response/chat-stream-consumer";
import {
  needsFallbackSynthesis,
  runSynthesisFallbackPass,
} from "@/lib/inngest/chat-response/chat-synthesis-pass";
import {
  completeAssistantResponse,
  persistAbortedAssistantResponse,
} from "@/lib/inngest/chat-response/complete-assistant-response";
import { buildOrchestratorToolSet } from "@/lib/inngest/chat-response/tool-set-builder";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { deleteScratchpadFiles } from "@/lib/subagents/delete-scratchpad-files";
import { wrapSubagentToolsWithApproval } from "@/lib/subagents/wrap-subagent-tools-with-approval";
import type { ReasoningEffort } from "@/schemas/providers/provider-registry";
import type { Agent } from "@/types/agent/agent";
import type { ApprovalMode, PendingApproval } from "@/types/tool/approval";

const log = getLogger(["inngest", "chat", "response"]);

/**
 * Registers MCP tools when supported by the active model, or determines external server status.
 * Separately registers isolated MCP tools for linked subagents so subagent MCP tools
 * never leak into the parent orchestrator's active tool set.
 *
 * @param isToolCallingModel - Whether the resolved model supports function calling
 * @param servers - Active external MCP servers for the parent orchestrator
 * @param selectedTools - Explicitly selected tool identifiers for the parent orchestrator
 * @param subagentServers - External MCP servers required by linked subagents
 * @param linkedSubagents - Linked subagents whose tool configurations may reference external MCP servers
 * @returns Registered tool state, subagent tool pool, source mapping, cleanup callback, and external availability flag
 * @author Maruf Bepary
 */
function mergeSubagentMcpTools(
  parentMcpTools: Record<string, any>,
  parentToolSourceMap: Record<string, string>,
  parentToolServerIdMap: Record<string, string>,
  parentToolRawNameMap: Record<string, string>,
  subMcp: {
    mcpTools: Record<string, any>;
    toolSourceMap: Record<string, string>;
    toolServerIdMap?: Record<string, string>;
    toolRawNameMap?: Record<string, string>;
  },
): {
  subagentMcpTools: Record<string, any>;
  mergedToolSourceMap: Record<string, string>;
  mergedToolServerIdMap: Record<string, string>;
  mergedToolRawNameMap: Record<string, string>;
} {
  const subagentMcpTools: Record<string, any> = { ...parentMcpTools };
  const mergedToolSourceMap: Record<string, string> = {
    ...parentToolSourceMap,
  };
  const mergedToolServerIdMap: Record<string, string> = {
    ...parentToolServerIdMap,
  };
  const mergedToolRawNameMap: Record<string, string> = {
    ...parentToolRawNameMap,
  };

  for (const [name, toolDef] of Object.entries(subMcp.mcpTools)) {
    const incomingServerId = subMcp.toolServerIdMap?.[name];
    const incomingServerName = subMcp.toolSourceMap[name];
    const incomingRawName = subMcp.toolRawNameMap?.[name] ?? name;

    if (!(name in subagentMcpTools)) {
      subagentMcpTools[name] = toolDef;
      if (incomingServerName) mergedToolSourceMap[name] = incomingServerName;
      if (incomingServerId) mergedToolServerIdMap[name] = incomingServerId;
      mergedToolRawNameMap[name] = incomingRawName;
      continue;
    }

    const existingServerId = mergedToolServerIdMap[name];
    const existingServerName = mergedToolSourceMap[name];
    if (
      (incomingServerId && existingServerId === incomingServerId) ||
      (!incomingServerId &&
        incomingServerName &&
        existingServerName === incomingServerName)
    ) {
      continue;
    }

    let counter = 2;
    let finalName = `${name.slice(0, 62)}_${counter}`;
    while (finalName in subagentMcpTools) {
      counter++;
      const suffix = `_${counter}`;
      finalName = `${name.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
    }

    subagentMcpTools[finalName] = toolDef;
    if (incomingServerName) mergedToolSourceMap[finalName] = incomingServerName;
    if (incomingServerId) mergedToolServerIdMap[finalName] = incomingServerId;
    mergedToolRawNameMap[finalName] = incomingRawName;
  }

  return {
    subagentMcpTools,
    mergedToolSourceMap,
    mergedToolServerIdMap,
    mergedToolRawNameMap,
  };
}

async function setupChatMcpTools(
  isToolCallingModel: boolean,
  servers: unknown,
  selectedTools?: string[],
  subagentServers?: unknown,
  linkedSubagents?: readonly { tools: string[] }[],
): Promise<{
  mcpTools: Record<string, any>;
  subagentMcpTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  toolServerIdMap: Record<string, string>;
  toolRawNameMap: Record<string, string>;
  mcpCleanup: () => Promise<void>;
  hasExternalMcpTools: boolean;
}> {
  if (!isToolCallingModel) {
    const hasExternalServers =
      (Array.isArray(servers) ? servers.length : 0) > 0;
    return {
      mcpTools: {},
      subagentMcpTools: {},
      toolSourceMap: {},
      toolServerIdMap: {},
      toolRawNameMap: {},
      mcpCleanup: async () => {},
      hasExternalMcpTools: hasExternalServers,
    };
  }

  const {
    mcpTools,
    toolSourceMap,
    toolServerIdMap = {},
    toolRawNameMap = {},
    mcpCleanup,
  } = await registerMcpTools(servers as any, selectedTools);

  if (Array.isArray(subagentServers) && subagentServers.length > 0) {
    const subagentSelectedTools = Array.from(
      new Set(
        (linkedSubagents ?? [])
          .flatMap((a) => a.tools)
          .filter((t) => !t.startsWith("internal:tool:")),
      ),
    );
    if (subagentSelectedTools.length > 0) {
      const subMcp = await registerMcpTools(
        subagentServers as any,
        subagentSelectedTools,
      );
      const {
        subagentMcpTools,
        mergedToolSourceMap,
        mergedToolServerIdMap,
        mergedToolRawNameMap,
      } = mergeSubagentMcpTools(
        mcpTools,
        toolSourceMap,
        toolServerIdMap,
        toolRawNameMap,
        subMcp,
      );
      return {
        mcpTools,
        subagentMcpTools,
        toolSourceMap: mergedToolSourceMap,
        toolServerIdMap: mergedToolServerIdMap,
        toolRawNameMap: mergedToolRawNameMap,
        mcpCleanup: async () => {
          await Promise.allSettled([mcpCleanup(), subMcp.mcpCleanup()]);
        },
        hasExternalMcpTools: Object.keys(mcpTools).length > 0,
      };
    }
  }

  return {
    mcpTools,
    subagentMcpTools: mcpTools,
    toolSourceMap,
    toolServerIdMap,
    toolRawNameMap,
    mcpCleanup,
    hasExternalMcpTools: Object.keys(mcpTools).length > 0,
  };
}

/**
 * Mutable state tracker for stream text, reasoning, and completed tools.
 */
interface ExecutionAccumulator {
  accumulatedText: string;
  accumulatedReasoning: string;
  completedTools: CompletedToolRecord[];
}

/**
 * Executes model streaming, handling user aborts, fallback synthesis, and final assistant persistence.
 *
 * @author Maruf Bepary
 */
async function executeModelStreamPipeline(options: {
  chatId: string;
  assistantMessageId: string;
  userMessageId: string;
  resolvedModelId: string;
  abortController: AbortController;
  emit: ReturnType<typeof createStreamEmitter>;
  toolSourceMap: Record<string, string>;
  toolServerIdMap: Record<string, string>;
  finalMessages: ReturnType<typeof prepareChatMessages>;
  hasArtifactTool: boolean;
  artifactTools: Record<string, any>;
  resolved: any;
  systemPrompt: string;
  allTools: Record<string, any> | undefined;
  result: ReturnType<typeof streamText>;
  accumulator: ExecutionAccumulator;
  persistAbortedResponse: () => Promise<boolean>;
  reasoningEffort?: ReasoningEffort;
  linkedSubagents?: readonly Agent[];
  assistantRowState: { persisted: boolean };
  approvalRound: number;
}): Promise<void> {
  const {
    chatId,
    assistantMessageId,
    userMessageId,
    resolvedModelId,
    abortController,
    emit,
    toolSourceMap,
    toolServerIdMap,
    finalMessages,
    hasArtifactTool,
    artifactTools,
    resolved,
    systemPrompt,
    allTools,
    result,
    accumulator,
    persistAbortedResponse,
    linkedSubagents,
    assistantRowState,
    approvalRound,
  } = options;

  const safeFinishReason = Promise.resolve(result.finishReason).catch(
    () => "stop",
  );
  const safeUsage = Promise.resolve(result.usage).catch(() => undefined);

  const streamState = await consumeModelStream(
    result.fullStream,
    abortController.signal,
    emit,
    toolSourceMap,
    accumulator.completedTools,
    linkedSubagents,
    {
      toolServerIdMap,
      round: approvalRound + 1,
      maxRounds: env.CHAT_MAX_APPROVAL_ROUNDS,
    },
  );

  accumulator.accumulatedText += streamState.accumulatedText;
  accumulator.accumulatedReasoning += streamState.accumulatedReasoning;

  if (streamState.aborted) {
    log.info("Stream loop aborted by user (chatId: {chatId})", { chatId });
    await persistAbortedResponse();
    return;
  }

  if (streamState.pendingApprovals.length > 0) {
    const round = approvalRound + 1;
    const metadata = buildAssistantFinishMetadata({
      model: resolvedModelId,
      reasoning: accumulator.accumulatedReasoning,
      completedTools: accumulator.completedTools,
      pendingApprovals: streamState.pendingApprovals,
      approvalRound: round,
      parentUserMessageId: userMessageId,
    });

    const persisted = assistantRowState.persisted
      ? await updateAssistantResponse({
          messageId: assistantMessageId,
          chatId,
          content: accumulator.accumulatedText,
          metadata,
        })
      : await persistAssistantResponse({
          chatId,
          assistantMessageId,
          content: accumulator.accumulatedText,
          parentId: userMessageId,
          metadata,
        });

    if (!persisted) {
      return;
    }

    assistantRowState.persisted = true;
    await emit({
      type: "tool-approval-required",
      approvals: streamState.pendingApprovals,
      round,
    });
    return;
  }

  if (
    needsFallbackSynthesis(
      abortController.signal.aborted,
      accumulator.accumulatedText,
      accumulator.completedTools.length,
    )
  ) {
    const synthState = await runSynthesisFallbackPass({
      chatId,
      finalMessages,
      completedTools: accumulator.completedTools,
      hasArtifactTool,
      artifactTools,
      resolved,
      resolvedModelId,
      abortController,
      systemPrompt,
      emit,
      toolSourceMap,
      reasoningEffort: options.reasoningEffort,
    });
    accumulator.accumulatedText += synthState.text;
    accumulator.accumulatedReasoning += synthState.reasoning;
  }

  if (abortController.signal.aborted) {
    log.info("Chat generation cleanly aborted by user (chatId: {chatId})", {
      chatId,
    });
    await persistAbortedResponse();
    return;
  }

  await completeAssistantResponse({
    chatId,
    assistantMessageId,
    userMessageId,
    accumulatedText: accumulator.accumulatedText,
    accumulatedReasoning: accumulator.accumulatedReasoning,
    resolvedModelId,
    completedTools: accumulator.completedTools,
    allTools,
    toolSourceMap,
    safeFinishReason,
    safeUsage,
    abortSignal: abortController.signal,
    emit,
    isUpdate: assistantRowState.persisted,
  });
}

/**
 * Handles errors during chat generation, persisting partial responses on abort
 * and cleaning up scratchpad files on unrecoverable failures.
 *
 * @author Maruf Bepary
 */
async function handleChatExecutionError(
  error: unknown,
  signal: AbortSignal,
  chatId: string,
  assistantMessageId: string,
  persistAbortedResponse: () => Promise<boolean>,
  emit: ReturnType<typeof createStreamEmitter>,
): Promise<void> {
  if (isAbortError(error, signal)) {
    await persistAbortedResponse();
  } else {
    await deleteScratchpadFiles(assistantMessageId);
  }
  await handleChatGenerationError(error, signal, chatId, emit);
}

async function readParkedApproval(assistantMessageId: string, chatId: string) {
  const [row] = await db
    .select({
      content: message.content,
      metadata: message.metadata,
      parentId: message.parentId,
    })
    .from(message)
    .where(
      and(
        eq(message.id, assistantMessageId),
        eq(message.chatId, chatId),
        eq(message.role, "assistant"),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    content: row.content ?? "",
    parentId: row.parentId,
    meta: parseMessageMetadata(row.metadata),
  };
}

async function readUserSelection(userMessageId: string, chatId: string) {
  const [row] = await db
    .select({ metadata: message.metadata })
    .from(message)
    .where(and(eq(message.id, userMessageId), eq(message.chatId, chatId)))
    .limit(1);

  return parseMessageMetadata(row?.metadata);
}

function buildMcpToolPolicyMaps(
  servers:
    | Array<{
        id?: string;
        autoApprovedTools?: string[];
        blockedTools?: string[];
      }>
    | undefined,
  subagentServers:
    | Array<{
        id?: string;
        autoApprovedTools?: string[];
        blockedTools?: string[];
      }>
    | undefined,
): {
  autoApprovedMcpToolsByServer: Record<string, string[]>;
  blockedMcpToolsByServer: Record<string, string[]>;
} {
  const autoApprovedMcpToolsByServer: Record<string, string[]> = {};
  const blockedMcpToolsByServer: Record<string, string[]> = {};
  for (const server of [...(servers ?? []), ...(subagentServers ?? [])]) {
    if (!server.id) continue;
    if (Array.isArray(server.autoApprovedTools)) {
      autoApprovedMcpToolsByServer[server.id] = server.autoApprovedTools;
    }
    if (Array.isArray(server.blockedTools)) {
      blockedMcpToolsByServer[server.id] = server.blockedTools;
    }
  }
  return { autoApprovedMcpToolsByServer, blockedMcpToolsByServer };
}

/**
 * Inngest durable function generating AI chat responses in the background.
 * Streams tokens, reasoning, and tool calls to Inngest Realtime channel,
 * survives client disconnections and page refreshes, and persists the
 * assistant message to the database upon completion.
 *
 * @author Maruf Bepary
 */
export const generateChatResponse = inngest.createFunction(
  {
    id: "generate-chat-response",
    retries: 0,
    concurrency: {
      key: "event.data.chatId",
      limit: 1,
    },
    triggers: [
      { event: "chat/response.generate" },
      { event: "chat/approval.respond" },
    ],
    cancelOn: [
      {
        event: "chat/response.cancel",
        if: "async.data.chatId == event.data.chatId && async.data.userId == event.data.userId",
      },
    ],
  },
  async ({ event }) => {
    const isApprovalResume = event.name === "chat/approval.respond";
    const { chatId, userId, userName, userEmail } = event.data;

    let userMessageId: string = event.data.userMessageId ?? "";
    let model: string | undefined = event.data.model;
    let reasoningEffort: ReasoningEffort | undefined =
      event.data.reasoningEffort;
    let selectedServerIds: string[] | undefined = event.data.selectedServerIds;
    let selectedTools: string[] | undefined = event.data.selectedTools;
    let selectedAgentId: string | undefined = event.data.selectedAgentId;
    const selectedAssistantId: string | undefined =
      event.data.selectedAssistantId;
    let selectedSkillIds: string[] | undefined = event.data.selectedSkillIds;
    let selectedKbIds: string[] | undefined = event.data.selectedKbIds;
    let subagentsEnabled: boolean | undefined = event.data.subagentsEnabled;
    let subagentModelId: string | undefined = event.data.subagentModelId;
    let subagentIds: string[] | undefined = event.data.subagentIds;
    let approvalMode: ApprovalMode | undefined = event.data.approvalMode;
    const assistantMessageId: string = isApprovalResume
      ? event.data.assistantMessageId
      : crypto.randomUUID();
    let approvalRound = 0;
    let parkedApprovals: PendingApproval[] = [];

    const { controller: abortController, release: releaseAbortController } =
      chatAbortRegistry.register(chatId);

    const ch = chatChannel({ chatId });
    const emit = createStreamEmitter(abortController.signal, ch.stream);

    let mcpCleanup: () => Promise<void> = async () => {};
    let resolvedModelId = model ?? "";
    const accumulator: ExecutionAccumulator = {
      accumulatedText: "",
      accumulatedReasoning: "",
      completedTools: [],
    };

    const assistantRowState = { persisted: isApprovalResume };

    const persistAbortedResponse = () =>
      persistAbortedAssistantResponse({
        chatId,
        assistantMessageId,
        userMessageId,
        resolvedModelId,
        accumulatedText: accumulator.accumulatedText,
        accumulatedReasoning: accumulator.accumulatedReasoning,
        completedTools: accumulator.completedTools,
        isUpdate: assistantRowState.persisted,
      });

    try {
      if (isApprovalResume) {
        const parked = await readParkedApproval(assistantMessageId, chatId);
        if (!parked || parked.meta.pendingApprovals.length === 0) {
          return;
        }
        userMessageId =
          event.data.userMessageId ??
          parked.meta.parentUserMessageId ??
          parked.parentId ??
          "";
        if (!userMessageId) {
          return;
        }

        const userMeta = await readUserSelection(userMessageId, chatId);
        model = userMeta.modelId ?? parked.meta.modelId ?? undefined;
        resolvedModelId = model ?? "";
        reasoningEffort = userMeta.reasoningEffort;
        selectedServerIds = userMeta.selectedServerIds ?? undefined;
        selectedTools = userMeta.selectedTools ?? undefined;
        selectedAgentId = userMeta.assistantId;
        selectedSkillIds = userMeta.selectedSkillIds ?? undefined;
        selectedKbIds = userMeta.selectedKbIds ?? undefined;
        subagentsEnabled = userMeta.subagentsEnabled;
        subagentModelId = userMeta.subagentModelId;
        subagentIds = userMeta.subagentIds;
        approvalMode = userMeta.approvalMode ?? parked.meta.approvalMode;

        accumulator.accumulatedText = parked.content;
        accumulator.accumulatedReasoning = parked.meta.reasoning ?? "";
        accumulator.completedTools = (
          parked.meta.toolData?.toolCalls ?? []
        ).map((tc) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
          serverName: tc.serverName,
          result: parked.meta.toolData?.toolResults.find(
            (tr) => tr.toolCallId === tc.toolCallId,
          )?.result,
        }));
        approvalRound = parked.meta.approvalRound;
        parkedApprovals = parked.meta.pendingApprovals;

        const approvedDecisionIds = new Set(
          event.data.decisions
            .filter(
              (d: { approvalId: string; approved: boolean }) => d.approved,
            )
            .map((d: { approvalId: string }) => d.approvalId),
        );
        for (const pa of parkedApprovals) {
          if (
            approvedDecisionIds.has(pa.approvalId) &&
            !accumulator.completedTools.some(
              (tc) => tc.toolCallId === pa.toolCallId,
            )
          ) {
            accumulator.completedTools.push({
              toolCallId: pa.toolCallId,
              toolName: pa.toolName,
              args: pa.args,
              serverName: pa.serverName,
            });
          }
        }
      }

      await emit({ type: "start", messageId: assistantMessageId });

      const { userSettings, resolved, workerResolved, ctx, thread } =
        await loadChatExecutionResources({
          userId,
          chatId,
          userMessageId,
          model,
          subagentModelId,
          selectedServerIds,
          selectedKbIds,
          selectedAgentId,
          selectedAssistantId,
          selectedSkillIds,
          selectedSubagentIds: subagentIds,
        });

      resolvedModelId = resolved.modelId;
      const isToolCallingModel = !!resolved.modelRow.capTools;

      const mcpState = await setupChatMcpTools(
        isToolCallingModel,
        ctx.servers,
        selectedTools,
        ctx.subagentServers,
        ctx.linkedSubagents,
      );
      mcpCleanup = mcpState.mcpCleanup;

      const sliced = sliceThreadFromLatestCompaction(thread);
      let compactionSummary = sliced.compactionSummary;
      const activeMessages = sliced.activeMessages;

      validateModelCapabilities({
        isToolCallingModel,
        hasExternalMcpTools: mcpState.hasExternalMcpTools,
        selectedTools,
        thread: activeMessages as any,
        capVision: resolved.modelRow.capVision,
      });

      const fileAttachments = extractFileAttachments(thread);
      const maxContextTokens = resolved.modelRow?.contextWindow
        ? Math.floor(resolved.modelRow.contextWindow * 0.85)
        : undefined;

      const summaryTokens = compactionSummary
        ? estimateTokens(compactionSummary)
        : 0;

      let effectiveHistory = activeMessages;
      if (maxContextTokens !== undefined && activeMessages.length > 2) {
        const estimatedHistoryTokens = assembleModelMessages(
          activeMessages,
        ).reduce((sum, m) => sum + estimateModelMessageTokens(m), 0);

        if (estimatedHistoryTokens + summaryTokens > maxContextTokens) {
          try {
            await emit({ type: "compacting" });
            const compacted = await compactChatThread({
              chatId,
              userId,
              thread,
              resolved,
              auto: true,
              reparentUserMessageId: userMessageId,
            });
            compactionSummary = compacted.summary;
            effectiveHistory = [thread[thread.length - 1]];
            await emit({ type: "compacted" });
          } catch (err) {
            log.warn(
              "Auto-compaction failed, falling back to truncation: {error}",
              {
                error: err instanceof Error ? err.message : String(err),
              },
            );
          }
        }
      }

      const finalSummaryTokens = compactionSummary
        ? estimateTokens(compactionSummary)
        : 0;
      const historyTokenBudget =
        maxContextTokens !== undefined
          ? Math.max(1, maxContextTokens - finalSummaryTokens)
          : undefined;

      const preparedMessages = prepareChatMessages({
        history: effectiveHistory,
        maxContextTokens: historyTokenBudget,
      });
      const finalMessages =
        isApprovalResume && parkedApprovals.length > 0
          ? [
              ...preparedMessages,
              ...buildApprovalResumeMessages(
                parkedApprovals,
                event.data.decisions,
              ),
            ]
          : preparedMessages;

      const internalToolOverrides = parseInternalToolApprovals(
        userSettings?.internalToolApprovals,
      );
      const { autoApprovedMcpToolsByServer, blockedMcpToolsByServer } =
        buildMcpToolPolicyMaps(ctx.servers, ctx.subagentServers);
      const resolvedApprovalMode: ApprovalMode =
        approvalMode ?? (userSettings?.defaultAutoApprove ? "auto" : "ask");

      const searchedToolNames = accumulator.completedTools.flatMap((t) => {
        if (t.toolName !== "search_app_tools") return [];
        const res = t.result as
          | { tools?: Array<{ name?: unknown }> }
          | undefined;
        if (!res || !Array.isArray(res.tools)) return [];
        return res.tools
          .map((item) => item?.name)
          .filter((name): name is string => typeof name === "string");
      });

      const preUnlockedToolNames = isApprovalResume
        ? new Set([
            ...parkedApprovals.map((a) => a.toolName),
            ...accumulator.completedTools.map((t) => t.toolName),
            ...searchedToolNames,
          ])
        : undefined;

      const {
        allTools,
        hasAnyTools,
        hasKbTool,
        hasArtifactTool,
        artifactTools,
        isSubagentDelegationEnabled,
      } = buildOrchestratorToolSet({
        userId,
        chatId,
        assistantMessageId,
        isToolCallingModel,
        mcpTools: mcpState.mcpTools,
        subagentMcpTools: mcpState.subagentMcpTools,
        toolSourceMap: mcpState.toolSourceMap,
        toolServerIdMap: mcpState.toolServerIdMap,
        selectedTools,
        ctx,
        fileAttachments,
        isMemoryEnabled: userSettings?.memoryEnabled ?? true,
        subagentsEnabled,
        resolved,
        resolvedModelId,
        workerResolved,
        internalToolOverrides,
        preUnlockedToolNames,
        wrapSubagentTools: (workerTools, targetAgent) => {
          const subagentApprovalMap = buildToolApproval(
            Object.keys(workerTools),
            resolvedApprovalMode,
            {
              internalToolOverrides,
              autoApprovedMcpToolsByServer,
              blockedMcpToolsByServer,
              toolServerIdMap: mcpState.toolServerIdMap,
              toolRawNameMap: mcpState.toolRawNameMap,
            },
          );
          return wrapSubagentToolsWithApproval({
            workerTools,
            toolApprovalMap: subagentApprovalMap,
            subagentId: targetAgent.id,
            subagentName: targetAgent.name,
            toolSourceMap: mcpState.toolSourceMap,
            toolServerIdMap: mcpState.toolServerIdMap,
            assistantMessageId,
            chatId,
            abortSignal: abortController.signal,
            emit,
            persistPendingApprovals: async (approvals, round) => {
              const metadata = buildAssistantFinishMetadata({
                model: resolvedModelId,
                reasoning: accumulator.accumulatedReasoning,
                completedTools: accumulator.completedTools,
                pendingApprovals: approvals,
                approvalRound: round,
                parentUserMessageId: userMessageId,
              });
              const updated = await updateAssistantResponse({
                messageId: assistantMessageId,
                chatId,
                content: accumulator.accumulatedText,
                metadata,
              });
              if (updated) {
                assistantRowState.persisted = true;
              } else {
                const created = await persistAssistantResponse({
                  chatId,
                  assistantMessageId,
                  content: accumulator.accumulatedText,
                  parentId: userMessageId,
                  metadata,
                });
                if (created) {
                  assistantRowState.persisted = true;
                }
              }
            },
            getNextRound: () => ++approvalRound,
            maxRounds: env.CHAT_MAX_APPROVAL_ROUNDS,
          });
        },
      });

      const toolApproval = allTools
        ? buildToolApproval(Object.keys(allTools), resolvedApprovalMode, {
            internalToolOverrides,
            autoApprovedMcpToolsByServer,
            blockedMcpToolsByServer,
            toolServerIdMap: mcpState.toolServerIdMap,
            toolRawNameMap: mcpState.toolRawNameMap,
          })
        : undefined;

      const orchestratorMaxSteps = resolveOrchestratorMaxSteps(
        isSubagentDelegationEnabled,
      );

      const canvasArtifacts = extractThreadCanvasArtifacts(thread);
      const isInteractiveUiEnabled =
        selectedTools === undefined ||
        selectedTools.includes(INTERNAL_TOOL_IDS.INTERACTIVE_UI);

      const baseSystemPrompt = buildSystemPrompt(
        userSettings?.globalSystemPrompt,
        ctx.projectRow?.globalPrompt,
        ctx.agentRow?.prompt,
        isToolCallingModel && hasKbTool,
        {
          attachmentNames: fileAttachments.map((a) => a.name),
          availableSkills: ctx.availableSkills,
          selectedSkills: ctx.selectedSkills,
          supportsTools: isToolCallingModel,
          userContext: { name: userName, email: userEmail },
          userMemories: ctx.userMemories,
          isSubagentDelegationEnabled,
          availableSubagents: ctx.linkedSubagents,
          canvasArtifacts,
          compactionSummary,
          isInteractiveUiEnabled,
        },
      );

      const hasDeniedDecision =
        isApprovalResume &&
        Array.isArray(event.data.decisions) &&
        event.data.decisions.some((d: { approved: boolean }) => !d.approved);
      const systemPrompt = hasDeniedDecision
        ? `${baseSystemPrompt}\n\n---\n\n## Tool Approval Policy\nIf the user denied a tool call, do NOT retry that exact tool call. Acknowledge the denial and proceed with alternative approaches or ask the user how they would like to proceed.`
        : baseSystemPrompt;

      const result = streamText(
        buildStreamExecutionConfig({
          resolved,
          resolvedModelId,
          abortSignal: abortController.signal,
          systemPrompt,
          finalMessages,
          allTools,
          hasAnyTools,
          maxSteps: orchestratorMaxSteps,
          reasoningEffort,
          toolApproval,
          experimental_toolApprovalSecret: toolApproval
            ? (env.TOOL_APPROVAL_SECRET ?? env.ENCRYPTION_SECRET)
            : undefined,
        }),
      );

      await executeModelStreamPipeline({
        chatId,
        assistantMessageId,
        userMessageId,
        resolvedModelId,
        abortController,
        emit,
        toolSourceMap: mcpState.toolSourceMap,
        toolServerIdMap: mcpState.toolServerIdMap,
        finalMessages,
        hasArtifactTool,
        artifactTools,
        resolved,
        systemPrompt,
        allTools,
        result,
        accumulator,
        persistAbortedResponse,
        reasoningEffort,
        linkedSubagents: ctx.linkedSubagents,
        assistantRowState,
        approvalRound,
      });
    } catch (error: unknown) {
      await handleChatExecutionError(
        error,
        abortController.signal,
        chatId,
        assistantMessageId,
        persistAbortedResponse,
        emit,
      );
    } finally {
      chatApprovalRegistry.cancel(assistantMessageId);
      releaseAbortController();
      await mcpCleanup();
    }
  },
);
