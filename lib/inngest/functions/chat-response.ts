import { streamText } from "ai";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import { prepareChatMessages } from "@/lib/chat/prepare-chat-messages";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
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

const log = getLogger(["inngest", "chat", "response"]);

/**
 * Registers MCP tools when supported by the active model, or determines external server status.
 *
 * @param isToolCallingModel - Whether the resolved model supports function calling
 * @param servers - Active external MCP servers
 * @param selectedTools - Explicitly selected tool identifiers
 * @returns Registered tool state, source mapping, cleanup callback, and external availability flag
 * @author Maruf Bepary
 */
async function setupChatMcpTools(
  isToolCallingModel: boolean,
  servers: unknown,
  selectedTools?: string[],
): Promise<{
  mcpTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  mcpCleanup: () => Promise<void>;
  hasExternalMcpTools: boolean;
}> {
  if (!isToolCallingModel) {
    const hasExternalServers =
      (Array.isArray(servers) ? servers.length : 0) > 0;
    return {
      mcpTools: {},
      toolSourceMap: {},
      mcpCleanup: async () => {},
      hasExternalMcpTools: hasExternalServers,
    };
  }

  const { mcpTools, toolSourceMap, mcpCleanup } = await registerMcpTools(
    servers as any,
    selectedTools,
  );
  return {
    mcpTools,
    toolSourceMap,
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
  finalMessages: ReturnType<typeof prepareChatMessages>;
  hasArtifactTool: boolean;
  artifactTools: Record<string, any>;
  resolved: any;
  systemPrompt: string;
  allTools: Record<string, any> | undefined;
  result: ReturnType<typeof streamText>;
  accumulator: ExecutionAccumulator;
  persistAbortedResponse: () => Promise<boolean>;
}): Promise<void> {
  const {
    chatId,
    assistantMessageId,
    userMessageId,
    resolvedModelId,
    abortController,
    emit,
    toolSourceMap,
    finalMessages,
    hasArtifactTool,
    artifactTools,
    resolved,
    systemPrompt,
    allTools,
    result,
    accumulator,
    persistAbortedResponse,
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
  );

  accumulator.accumulatedText = streamState.accumulatedText;
  accumulator.accumulatedReasoning = streamState.accumulatedReasoning;

  if (streamState.aborted) {
    log.info("Stream loop aborted by user (chatId: {chatId})", { chatId });
    await persistAbortedResponse();
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
    } = event.data;

    const { controller: abortController, release: releaseAbortController } =
      chatAbortRegistry.register(chatId);

    const ch = chatChannel({ chatId });
    const assistantMessageId = crypto.randomUUID();
    const emit = createStreamEmitter(abortController.signal, ch.stream);

    let mcpCleanup: () => Promise<void> = async () => {};
    let resolvedModelId = model ?? "";
    const accumulator: ExecutionAccumulator = {
      accumulatedText: "",
      accumulatedReasoning: "",
      completedTools: [],
    };

    const persistAbortedResponse = () =>
      persistAbortedAssistantResponse({
        chatId,
        assistantMessageId,
        userMessageId,
        resolvedModelId,
        accumulatedText: accumulator.accumulatedText,
        accumulatedReasoning: accumulator.accumulatedReasoning,
        completedTools: accumulator.completedTools,
      });

    try {
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
          selectedAssistantId,
          selectedSkillIds,
        });

      resolvedModelId = resolved.modelId;
      const isToolCallingModel = !!resolved.modelRow.capTools;

      const mcpState = await setupChatMcpTools(
        isToolCallingModel,
        ctx.servers,
        selectedTools,
      );
      mcpCleanup = mcpState.mcpCleanup;

      validateModelCapabilities({
        isToolCallingModel,
        hasExternalMcpTools: mcpState.hasExternalMcpTools,
        selectedTools,
        thread: thread as any,
        capVision: resolved.modelRow.capVision,
      });

      const fileAttachments = extractFileAttachments(thread);
      const maxContextTokens = resolved.modelRow?.contextWindow
        ? Math.floor(resolved.modelRow.contextWindow * 0.85)
        : undefined;
      const finalMessages = prepareChatMessages({
        history: thread,
        maxContextTokens,
      });

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
        selectedTools,
        ctx,
        fileAttachments,
        isMemoryEnabled: userSettings?.memoryEnabled ?? true,
        subagentsEnabled,
        resolved,
        resolvedModelId,
        workerResolved,
      });

      const orchestratorMaxSteps = resolveOrchestratorMaxSteps(
        isSubagentDelegationEnabled,
      );

      const systemPrompt = buildSystemPrompt(
        userSettings?.globalSystemPrompt,
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

      await executeModelStreamPipeline({
        chatId,
        assistantMessageId,
        userMessageId,
        resolvedModelId,
        abortController,
        emit,
        toolSourceMap: mcpState.toolSourceMap,
        finalMessages,
        hasArtifactTool,
        artifactTools,
        resolved,
        systemPrompt,
        allTools,
        result,
        accumulator,
        persistAbortedResponse,
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
      releaseAbortController();
      await mcpCleanup();
    }
  },
);
