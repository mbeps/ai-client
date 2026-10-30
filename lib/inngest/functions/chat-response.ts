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
    let accumulatedText = "";
    let accumulatedReasoning = "";
    const completedTools: CompletedToolRecord[] = [];

    const persistAbortedResponse = () =>
      persistAbortedAssistantResponse({
        chatId,
        assistantMessageId,
        userMessageId,
        resolvedModelId,
        accumulatedText,
        accumulatedReasoning,
        completedTools,
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

      const globalSystemPrompt = userSettings?.globalSystemPrompt;
      const isMemoryEnabled = userSettings?.memoryEnabled ?? true;
      const resolvedModelRow = {
        capVision: resolved.modelRow.capVision,
        capTools: resolved.modelRow.capTools,
      };
      resolvedModelId = resolved.modelId;

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

      const streamState = await consumeModelStream(
        result.fullStream,
        abortController.signal,
        emit,
        toolSourceMap,
        completedTools,
      );

      accumulatedText = streamState.accumulatedText;
      accumulatedReasoning = streamState.accumulatedReasoning;

      if (streamState.aborted) {
        log.info("Stream loop aborted by user (chatId: {chatId})", {
          chatId,
        });
        await deleteScratchpadFiles(assistantMessageId);
        await persistAbortedResponse();
        return;
      }

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
        await deleteScratchpadFiles(assistantMessageId);
        await persistAbortedResponse();
        return;
      }

      await completeAssistantResponse({
        chatId,
        assistantMessageId,
        userMessageId,
        accumulatedText,
        accumulatedReasoning,
        resolvedModelId,
        completedTools,
        allTools,
        toolSourceMap,
        safeFinishReason,
        safeUsage,
        abortSignal: abortController.signal,
        emit,
      });
    } catch (error: unknown) {
      await deleteScratchpadFiles(assistantMessageId);
      if (isAbortError(error, abortController.signal)) {
        await persistAbortedResponse();
      }
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
