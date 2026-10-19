import { isStepCount, type ModelMessage, streamText } from "ai";
import { env } from "@/config/env";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import {
  ChatNotFoundError,
  loadChatContext,
} from "@/lib/chat/load-chat-context";
import { loadThreadFromDb } from "@/lib/chat/load-thread-from-db";
import { persistAssistantResponse } from "@/lib/chat/persist-response";
import { prepareChatMessages } from "@/lib/chat/prepare-chat-messages";
import { registerArtifactTool } from "@/lib/chat/register-artifact-tool";
import { registerFileUrlTool } from "@/lib/chat/register-file-url-tool";
import { registerKnowledgebaseTool } from "@/lib/chat/register-knowledgebase-tool";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { registerMemoryTool } from "@/lib/chat/register-memory-tool";
import { registerSkillAuthoringTools } from "@/lib/chat/register-skill-authoring-tools";
import { registerSkillTool } from "@/lib/chat/register-skill-tool";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import { checkVisionSupport } from "@/lib/chat/vision-guard";
import { classifyProviderError } from "@/lib/error/classify-provider-error";
import { ToolsNotSupportedError, VisionNotSupportedError } from "@/lib/errors";
import { type ChatStreamEvent, chatChannel } from "@/lib/inngest/channels";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { registerScratchpadTools } from "@/lib/subagents/register-subagent-tools";
import {
  createSubagentDispatchTool,
  sanitizeSubagentOutput,
} from "@/lib/subagents/subagent-dispatch-tool";
import { getUserSettingsByUserId } from "@/lib/user/get-user-settings-by-id";

const log = getLogger(["inngest", "chat", "response"]);

interface CompletedToolRecord {
  toolCallId: string;
  toolName: string;
  args: any;
  result?: any;
  serverName?: string;
}

interface BuildOrchestratorToolSetParams {
  userId: string;
  chatId: string;
  assistantMessageId: string;
  isToolCallingModel: boolean;
  mcpTools: Record<string, any>;
  selectedTools?: string[];
  ctx: {
    activeKbIds?: string[];
    activeKbId?: string | null;
    kbIsReady?: boolean;
    availableSkills: any[];
  };
  fileAttachments: Array<{ name: string; key: string; type?: string }>;
  isMemoryEnabled: boolean;
  subagentsEnabled?: boolean;
  subagentExcludedTools?: string[];
  resolved: any;
  resolvedModelId: string;
  workerResolved: any;
}

interface OrchestratorToolSetResult {
  orchestratorActiveTools: Record<string, any>;
  subagentDispatchTools: Record<string, any>;
  allTools?: Record<string, any>;
  hasAnyTools: boolean;
  hasKbTool: boolean;
  hasArtifactTool: boolean;
  artifactTools: Record<string, any>;
  isSubagentDelegationEnabled: boolean;
}

interface SynthesisFallbackParams {
  chatId: string;
  finalMessages: ModelMessage[];
  completedTools: CompletedToolRecord[];
  hasArtifactTool: boolean;
  artifactTools: Record<string, any>;
  resolved: any;
  resolvedModelId: string;
  abortController: AbortController;
  systemPrompt: string;
  emit: (data: ChatStreamEvent) => Promise<void>;
  toolSourceMap: Record<string, string>;
}

interface ConsumeModelStreamResult {
  accumulatedText: string;
  accumulatedReasoning: string;
  aborted: boolean;
}

/** Formats tool error payload into a reliable error string */
function formatToolErrorMessage(rawErr: unknown): string {
  if (rawErr instanceof Error) {
    return rawErr.message;
  }
  if (typeof rawErr === "string") {
    return rawErr;
  }
  return JSON.stringify(rawErr ?? "Tool execution failed");
}

/** Determines if error represents an abort condition */
function isAbortError(error: unknown, abortSignal: AbortSignal): boolean {
  return (
    abortSignal.aborted ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/** Determines if error represents a chat not found condition */
function isChatNotFoundError(error: unknown): boolean {
  return (
    error instanceof ChatNotFoundError ||
    (error as Record<string, unknown> | null)?.code === "CHAT_NOT_FOUND"
  );
}

/** Validates that model capabilities satisfy user and tool requirements */
function validateModelCapabilities(params: {
  isToolCallingModel: boolean;
  hasExternalMcpTools: boolean;
  selectedTools?: string[];
  thread: any[];
  capVision?: boolean;
}): void {
  const {
    isToolCallingModel,
    hasExternalMcpTools,
    selectedTools,
    thread,
    capVision,
  } = params;

  const requestedExternalMcp =
    hasExternalMcpTools ||
    Boolean(
      selectedTools?.some(
        (id: string) =>
          !id.startsWith("internal:tool:") &&
          id !== "search_knowledge_base" &&
          id !== "get_file_url" &&
          id !== "load_skill",
      ),
    );

  if (!isToolCallingModel && requestedExternalMcp) {
    throw new ToolsNotSupportedError();
  }

  if (!checkVisionSupport(thread, Boolean(capVision))) {
    throw new VisionNotSupportedError();
  }
}

/** Extracts valid file attachment metadata with storage keys from chat history */
function extractFileAttachments(thread: any[]) {
  return thread
    .flatMap((m) => m.attachments ?? [])
    .map((a: any) => ({ name: a.name, key: a.key, type: a.type }))
    .filter((a: any) => a.key);
}

/** Determines active target knowledge base IDs from context */
function resolveTargetKbIds(ctx: {
  activeKbIds?: string[];
  activeKbId?: string | null;
}): string[] {
  if (ctx.activeKbIds && ctx.activeKbIds.length > 0) {
    return ctx.activeKbIds;
  }
  return ctx.activeKbId ? [ctx.activeKbId] : [];
}

/** Checks whether a specific internal tool is permitted by selectedTools */
function isInternalToolAllowed(
  toolId: string,
  selectedTools?: string[],
): boolean {
  return selectedTools === undefined || selectedTools.includes(toolId);
}

/** Resolves model provider for main chat generation */
function resolveChatProvider(userId: string, model?: string) {
  return model
    ? resolveProvider(userId, model)
    : resolveDefaultChatProvider(userId);
}

/** Resolves model provider for subagent workers if configured */
function resolveWorkerChatProvider(userId: string, subagentModelId?: string) {
  if (!subagentModelId) {
    return Promise.resolve(null);
  }
  return resolveProvider(userId, subagentModelId).catch(() => null);
}

/** Creates a bound emitter function publishing events to Inngest Realtime */
function createStreamEmitter(abortSignal: AbortSignal, streamName: string) {
  return async (data: ChatStreamEvent) => {
    if (abortSignal.aborted) return;
    try {
      await inngest.realtime.publish(streamName, data);
    } catch (err) {
      log.warn("Failed to publish chat stream event to Inngest Realtime", {
        error: err instanceof Error ? err.message : String(err),
        type: data.type,
      });
    }
  };
}

/** Handles a tool-call chunk by updating completedTools and emitting event */
async function handleToolCallChunk(
  chunk: any,
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
): Promise<void> {
  const serverName = toolSourceMap[chunk.toolName];
  const args = chunk.args ?? chunk.input;
  completedTools.push({
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    args,
    serverName,
  });
  await emit({
    type: "tool-call",
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    args,
    serverName,
  });
}

/** Handles a tool-result chunk by sanitizing output and emitting event */
async function handleToolResultChunk(
  chunk: any,
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
): Promise<void> {
  const isPreliminary = Boolean(chunk.preliminary);
  const rawResult = chunk.result ?? chunk.output;
  const tc = completedTools.find((t) => t.toolCallId === chunk.toolCallId);
  const isSubagent =
    chunk.toolName === "delegate_task" ||
    chunk.toolName === INTERNAL_TOOL_IDS.DELEGATE_TASK;
  const finalResult = isSubagent
    ? sanitizeSubagentOutput(rawResult)
    : rawResult;

  if (tc && !isPreliminary) {
    tc.result = finalResult;
  }
  const serverName = tc?.serverName ?? toolSourceMap[chunk.toolName];
  await emit({
    type: "tool-result",
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    result: isPreliminary ? rawResult : finalResult,
    serverName,
    preliminary: isPreliminary,
  });
}

/** Handles a tool-error chunk by formatting error message and emitting event */
async function handleToolErrorChunk(
  chunk: any,
  completedTools: CompletedToolRecord[],
  toolSourceMap: Record<string, string>,
  emit: (data: ChatStreamEvent) => Promise<void>,
): Promise<void> {
  const tc = completedTools.find((t) => t.toolCallId === chunk.toolCallId);
  const errorResult = { error: formatToolErrorMessage(chunk.error) };
  if (tc) {
    tc.result = errorResult;
  }
  const serverName = tc?.serverName ?? toolSourceMap[chunk.toolName];
  await emit({
    type: "tool-result",
    toolCallId: chunk.toolCallId,
    toolName: chunk.toolName,
    result: errorResult,
    serverName,
  });
}

/** Determines whether subagent task delegation is enabled */
function isSubagentEnabled(
  subagentsEnabled?: boolean,
  selectedTools?: string[],
): boolean {
  return (
    subagentsEnabled === true ||
    Boolean(selectedTools?.includes(INTERNAL_TOOL_IDS.DELEGATE_TASK))
  );
}

/** Builds scratchpad tools if subagent delegation is active */
function buildScratchpadTools(
  enabled: boolean,
  chatId: string,
  messageId: string,
): Record<string, any> {
  if (!enabled) return {};
  return registerScratchpadTools({
    chatId,
    messageId,
    workerRole: "orchestrator",
  });
}

/** Builds subagent dispatch tools if delegation is enabled */
function buildSubagentDispatchTools(params: {
  isSubagentDelegationEnabled: boolean;
  orchestratorActiveTools: Record<string, any>;
  subagentExcludedTools?: string[];
  resolved: any;
  resolvedModelId: string;
  workerResolved: any;
}): Record<string, any> {
  if (!params.isSubagentDelegationEnabled) {
    return {};
  }
  const customWorkerModel = params.workerResolved
    ? params.workerResolved.sdkProvider.chat(params.workerResolved.modelId)
    : undefined;
  return {
    delegate_task: createSubagentDispatchTool({
      defaultModel: params.resolved.sdkProvider.chat(params.resolvedModelId),
      customWorkerModel,
      availableTools: params.orchestratorActiveTools,
      excludedTools: params.subagentExcludedTools,
      maxSteps: env.CHAT_MAX_STEPS,
    }),
  };
}

/**
 * Builds and registers all orchestrator and subagent dispatch tools.
 */
function buildOrchestratorToolSet(
  params: BuildOrchestratorToolSetParams,
): OrchestratorToolSetResult {
  const {
    userId,
    chatId,
    assistantMessageId,
    isToolCallingModel,
    mcpTools,
    selectedTools,
    ctx,
    fileAttachments,
    isMemoryEnabled,
    subagentsEnabled,
    subagentExcludedTools,
    resolved,
    resolvedModelId,
    workerResolved,
  } = params;

  if (!isToolCallingModel) {
    return {
      orchestratorActiveTools: {},
      subagentDispatchTools: {},
      allTools: undefined,
      hasAnyTools: false,
      hasKbTool: false,
      hasArtifactTool: false,
      artifactTools: {},
      isSubagentDelegationEnabled: false,
    };
  }

  const targetKbIds = resolveTargetKbIds(ctx);
  const kbTools = registerKnowledgebaseTool(
    targetKbIds,
    ctx.kbIsReady,
    userId,
    selectedTools,
  );
  const hasKbTool = Object.keys(kbTools).length > 0;

  const isArtifactSelected = isInternalToolAllowed(
    INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    selectedTools,
  );
  const artifactTools = isArtifactSelected ? registerArtifactTool() : {};
  const hasArtifactTool = Object.keys(artifactTools).length > 0;

  const memoryTools = isMemoryEnabled
    ? registerMemoryTool(userId, selectedTools)
    : {};

  const skillTools =
    ctx.availableSkills.length > 0 ? registerSkillTool(userId) : {};

  const skillAuthoringTools = isInternalToolAllowed(
    INTERNAL_TOOL_IDS.MANAGE_SKILL,
    selectedTools,
  )
    ? registerSkillAuthoringTools(userId)
    : {};

  const isSubagentDelegationEnabled = isSubagentEnabled(
    subagentsEnabled,
    selectedTools,
  );

  const scratchpadTools = buildScratchpadTools(
    isSubagentDelegationEnabled,
    chatId,
    assistantMessageId,
  );

  const fileUrlTools =
    fileAttachments.length > 0 ? registerFileUrlTool(fileAttachments) : {};

  const orchestratorActiveTools: Record<string, any> = Object.assign(
    {},
    mcpTools,
    artifactTools,
    memoryTools,
    kbTools,
    skillTools,
    skillAuthoringTools,
    fileUrlTools,
    scratchpadTools,
  );

  const subagentDispatchTools = buildSubagentDispatchTools({
    isSubagentDelegationEnabled,
    orchestratorActiveTools,
    subagentExcludedTools,
    resolved,
    resolvedModelId,
    workerResolved,
  });

  const allTools = Object.assign(
    {},
    orchestratorActiveTools,
    subagentDispatchTools,
  );
  const hasAnyTools = Object.keys(allTools).length > 0;

  return {
    orchestratorActiveTools,
    subagentDispatchTools,
    allTools: hasAnyTools ? allTools : undefined,
    hasAnyTools,
    hasKbTool,
    hasArtifactTool,
    artifactTools,
    isSubagentDelegationEnabled,
  };
}

/**
 * Consumes chunks from a model stream, emits realtime events, and tracks completed tools.
 */
async function consumeModelStream(
  fullStream: AsyncIterable<any>,
  abortSignal: AbortSignal,
  emit: (data: ChatStreamEvent) => Promise<void>,
  toolSourceMap: Record<string, string>,
  completedTools: CompletedToolRecord[],
): Promise<ConsumeModelStreamResult> {
  let accumulatedText = "";
  let accumulatedReasoning = "";

  for await (const chunk of fullStream) {
    if (abortSignal.aborted) {
      return { accumulatedText, accumulatedReasoning, aborted: true };
    }

    if (chunk.type === "text-delta") {
      accumulatedText += chunk.text;
      await emit({ type: "text-delta", text: chunk.text });
    } else if (chunk.type === "reasoning-delta") {
      accumulatedReasoning += chunk.text;
      await emit({ type: "reasoning-delta", reasoning: chunk.text });
    } else if (chunk.type === "tool-call") {
      await handleToolCallChunk(chunk, completedTools, toolSourceMap, emit);
    } else if (chunk.type === "tool-result") {
      await handleToolResultChunk(chunk, completedTools, toolSourceMap, emit);
    } else if (chunk.type === "tool-error") {
      await handleToolErrorChunk(chunk, completedTools, toolSourceMap, emit);
    }
  }

  return { accumulatedText, accumulatedReasoning, aborted: false };
}

/** Evaluates whether fallback synthesis pass should run */
function needsFallbackSynthesis(
  aborted: boolean,
  accumulatedText: string,
  completedToolsCount: number,
): boolean {
  return (
    !aborted && accumulatedText.trim().length === 0 && completedToolsCount > 0
  );
}

/**
 * Runs a fallback synthesis pass when tool execution yielded no text.
 */
async function runSynthesisFallbackPass(
  params: SynthesisFallbackParams,
): Promise<{ text: string; reasoning: string }> {
  const {
    chatId,
    finalMessages,
    completedTools,
    hasArtifactTool,
    artifactTools,
    resolved,
    resolvedModelId,
    abortController,
    systemPrompt,
    emit,
    toolSourceMap,
  } = params;

  log.info(
    "Triggering fallback synthesis pass after tool execution (chatId: {chatId})",
    { chatId },
  );

  const synthesisMessages: ModelMessage[] = [
    ...finalMessages,
    {
      role: "assistant",
      content: completedTools.map((tc) => ({
        type: "tool-call" as const,
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        input: tc.args,
      })),
    },
    {
      role: "tool",
      content: completedTools.map((tc) => ({
        type: "tool-result" as const,
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        output: {
          type: "text" as const,
          value:
            typeof tc.result === "string"
              ? tc.result
              : JSON.stringify(tc.result ?? "Task completed"),
        },
      })),
    },
    {
      role: "user",
      content:
        "Synthesize all the research and findings above into a comprehensive, high-quality final response for the user. " +
        (hasArtifactTool
          ? "If the user requested a document, report, table, code, or canvas artifact, you MUST call manage_artifact now to create it."
          : ""),
    },
  ];

  try {
    const synthResult = streamText({
      model: resolved.sdkProvider.chat(resolvedModelId),
      abortSignal: abortController.signal,
      instructions: systemPrompt,
      messages: synthesisMessages,
      tools: hasArtifactTool ? artifactTools : undefined,
      stopWhen: isStepCount(3),
    });

    const synthState = await consumeModelStream(
      synthResult.fullStream,
      abortController.signal,
      emit,
      toolSourceMap,
      completedTools,
    );

    return {
      text: synthState.accumulatedText,
      reasoning: synthState.accumulatedReasoning,
    };
  } catch (synthErr) {
    log.warn("Synthesis fallback pass encountered error: {error}", {
      error: synthErr instanceof Error ? synthErr.message : String(synthErr),
    });
    return { text: "", reasoning: "" };
  }
}

/** Computes maximum tool step allowance for orchestrator */
function resolveOrchestratorMaxSteps(
  isSubagentDelegationEnabled: boolean,
): number {
  return isSubagentDelegationEnabled
    ? Math.max(env.CHAT_MAX_STEPS * 2, 20)
    : env.CHAT_MAX_STEPS;
}

/** Configures parameters for primary text streaming invocation */
function buildStreamExecutionConfig(params: {
  resolved: any;
  resolvedModelId: string;
  abortSignal: AbortSignal;
  systemPrompt: string;
  finalMessages: ModelMessage[];
  allTools?: Record<string, any>;
  hasAnyTools: boolean;
  maxSteps: number;
}) {
  return {
    model: params.resolved.sdkProvider.chat(params.resolvedModelId),
    abortSignal: params.abortSignal,
    instructions: params.systemPrompt,
    messages: params.finalMessages,
    tools: params.allTools,
    stopWhen: params.hasAnyTools ? isStepCount(params.maxSteps) : undefined,
  };
}

/**
 * Builds assistant message metadata payload for persistence.
 */
function buildAssistantMessageMetadata({
  modelId,
  reasoning,
  completedTools,
  usage,
  finishReason,
}: {
  modelId: string;
  reasoning: string;
  completedTools: CompletedToolRecord[];
  usage: any;
  finishReason: string;
}): string {
  return JSON.stringify({
    model: modelId,
    reasoning,
    toolCalls: completedTools.map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      args: tc.args,
      ...(tc.serverName ? { serverName: tc.serverName } : {}),
    })),
    toolResults: completedTools.map((tc) => ({
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      result:
        tc.result !== undefined
          ? tc.result
          : { error: "Tool execution was interrupted" },
      ...(tc.serverName ? { serverName: tc.serverName } : {}),
    })),
    usage,
    finishReason,
  });
}

/**
 * Handles errors during generation with clean abort/cancellation checking.
 */
async function handleChatGenerationError(
  error: unknown,
  abortSignal: AbortSignal,
  chatId: string,
  emit: (data: ChatStreamEvent) => Promise<void>,
): Promise<void> {
  if (isAbortError(error, abortSignal)) {
    log.info("Chat generation cleanly aborted by user (chatId: {chatId})", {
      chatId,
    });
    return;
  }
  if (isChatNotFoundError(error)) {
    log.info(
      "Chat generation cleanly aborted or chat not found (chatId: {chatId})",
      { chatId },
    );
    return;
  }
  const effectiveError = classifyProviderError(error) ?? error;
  const errorMsg =
    effectiveError instanceof Error
      ? effectiveError.message
      : "Generation failed";
  const errorCode = (effectiveError as any)?.code;
  log.error("Chat generation failed in Inngest (chatId: {chatId}): {error}", {
    chatId,
    error: errorMsg,
  });
  await emit({ type: "error", message: errorMsg, code: errorCode });
  throw error;
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
    triggers: [{ event: "chat/response.generate" }],
    cancelOn: [
      {
        event: "chat/response.cancel",
        if: "async.data.chatId == event.data.chatId && async.data.userId == event.data.userId",
      },
    ],
  },
  async ({ event }) => {
    const {
      chatId,
      userId,
      userName,
      userEmail,
      userMessageId,
      model,
      selectedServerIds,
      selectedTools,
      selectedAssistantId,
      selectedSkillIds,
      selectedKbIds,
      subagentsEnabled,
      subagentModelId,
      subagentExcludedTools,
    } = event.data;

    const { controller: abortController, release: releaseAbortController } =
      chatAbortRegistry.register(chatId);

    const ch = chatChannel({ chatId });
    const assistantMessageId = crypto.randomUUID();
    const emit = createStreamEmitter(abortController.signal, ch.stream);

    let mcpCleanup: () => Promise<void> = async () => {};

    try {
      await emit({ type: "start", messageId: assistantMessageId });

      const [userSettings, resolved, workerResolved, ctx, thread] =
        await Promise.all([
          getUserSettingsByUserId(userId).catch(() => null),
          resolveChatProvider(userId, model),
          resolveWorkerChatProvider(userId, subagentModelId),
          loadChatContext(
            chatId,
            userId,
            selectedServerIds,
            selectedKbIds,
            selectedAssistantId,
            selectedSkillIds,
          ),
          loadThreadFromDb(chatId, userMessageId, userId),
        ]);

      const globalSystemPrompt = userSettings?.globalSystemPrompt;
      const isMemoryEnabled = userSettings?.memoryEnabled ?? true;
      const resolvedModelRow = {
        capVision: resolved.modelRow.capVision,
        capTools: resolved.modelRow.capTools,
      };
      const resolvedModelId = resolved.modelId;

      const {
        mcpTools,
        toolSourceMap,
        mcpCleanup: registeredCleanup,
      } = await registerMcpTools(ctx.servers as any, selectedTools);
      mcpCleanup = registeredCleanup;

      const hasExternalMcpTools = Object.keys(mcpTools).length > 0;
      const isToolCallingModel = !!resolvedModelRow?.capTools;

      validateModelCapabilities({
        isToolCallingModel,
        hasExternalMcpTools,
        selectedTools,
        thread: thread as any,
        capVision: resolvedModelRow?.capVision,
      });

      const fileAttachments = extractFileAttachments(thread);
      const finalMessages = prepareChatMessages({ history: thread });

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
        mcpTools,
        selectedTools,
        ctx,
        fileAttachments,
        isMemoryEnabled,
        subagentsEnabled,
        subagentExcludedTools,
        resolved,
        resolvedModelId,
        workerResolved,
      });

      const orchestratorMaxSteps = resolveOrchestratorMaxSteps(
        isSubagentDelegationEnabled,
      );

      const systemPrompt = buildSystemPrompt(
        globalSystemPrompt,
        ctx.projectRow?.globalPrompt,
        ctx.assistantRow?.prompt,
        isToolCallingModel && hasKbTool,
        {
          attachmentNames: fileAttachments.map((a) => a.name),
          availableSkills: ctx.availableSkills,
          selectedSkills: ctx.selectedSkills,
          supportsTools: isToolCallingModel,
          userContext: { name: userName, email: userEmail },
          userMemories: ctx.userMemories,
          isSubagentDelegationEnabled,
        },
      );

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
        }),
      );

      const safeFinishReason = Promise.resolve(result.finishReason).catch(
        () => "stop",
      );
      const safeUsage = Promise.resolve(result.usage).catch(() => undefined);

      const completedTools: CompletedToolRecord[] = [];

      const streamState = await consumeModelStream(
        result.fullStream,
        abortController.signal,
        emit,
        toolSourceMap,
        completedTools,
      );

      if (streamState.aborted) {
        log.info("Stream loop aborted by user (chatId: {chatId})", {
          chatId,
        });
        return;
      }

      let accumulatedText = streamState.accumulatedText;
      let accumulatedReasoning = streamState.accumulatedReasoning;

      if (
        needsFallbackSynthesis(
          abortController.signal.aborted,
          accumulatedText,
          completedTools.length,
        )
      ) {
        const synthState = await runSynthesisFallbackPass({
          chatId,
          finalMessages,
          completedTools,
          hasArtifactTool,
          artifactTools,
          resolved,
          resolvedModelId,
          abortController,
          systemPrompt,
          emit,
          toolSourceMap,
        });
        accumulatedText += synthState.text;
        accumulatedReasoning += synthState.reasoning;
      }

      if (abortController.signal.aborted) {
        log.info("Chat generation cleanly aborted by user (chatId: {chatId})", {
          chatId,
        });
        return;
      }

      const finishReason = await safeFinishReason;
      const usage = await safeUsage;

      const metadata = buildAssistantMessageMetadata({
        modelId: resolvedModelId,
        reasoning: accumulatedReasoning,
        completedTools,
        usage,
        finishReason,
      });

      // Pre-persistence abort check: halt if aborted during completion processing
      if (abortController.signal.aborted) {
        log.info(
          "Chat generation cleanly aborted before persistence (chatId: {chatId})",
          { chatId },
        );
        return;
      }

      // Persist completed assistant message to database
      const persisted = await persistAssistantResponse({
        chatId,
        assistantMessageId,
        content: accumulatedText,
        parentId: userMessageId,
        metadata,
      });

      if (!persisted) {
        log.info(
          "Chat was deleted concurrently; skipping completion emit (chatId: {chatId})",
          { chatId },
        );
        return;
      }

      await emit({
        type: "finish",
        finishReason,
        usage,
      });

      log.info(
        "Chat response successfully generated and persisted (chatId: {chatId}, messageId: {assistantMessageId})",
        { chatId, assistantMessageId },
      );
    } catch (error: unknown) {
      await handleChatGenerationError(
        error,
        abortController.signal,
        chatId,
        emit,
      );
    } finally {
      releaseAbortController();
      await mcpCleanup();
    }
  },
);
