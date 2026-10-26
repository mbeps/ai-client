import { isStepCount, type ModelMessage } from "ai";
import { env } from "@/config/env";
import {
  ChatNotFoundError,
  loadChatContext,
} from "@/lib/chat/load-chat-context";
import { loadThreadFromDb } from "@/lib/chat/load-thread-from-db";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import { checkVisionSupport } from "@/lib/chat/vision-guard";
import { classifyProviderError } from "@/lib/error/classify-provider-error";
import { ToolsNotSupportedError } from "@/lib/error/tools-not-supported-error";
import { VisionNotSupportedError } from "@/lib/error/vision-not-supported-error";
import type { ChatStreamEvent } from "@/lib/inngest/chat-channel";
import type { CompletedToolRecord } from "@/lib/inngest/chat-response/chat-response-types";
import { getLogger } from "@/lib/logger";
import { getUserSettingsByUserId } from "@/lib/user/get-user-settings-by-id";

const log = getLogger(["inngest", "chat", "response"]);

/**
 * Determines if error represents an abort condition.
 * @author Maruf Bepary
 */
export function isAbortError(
  error: unknown,
  abortSignal: AbortSignal,
): boolean {
  return (
    abortSignal.aborted ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/**
 * Determines if error represents a chat not found condition.
 * @author Maruf Bepary
 */
export function isChatNotFoundError(error: unknown): boolean {
  return (
    error instanceof ChatNotFoundError ||
    (error as Record<string, unknown> | null)?.code === "CHAT_NOT_FOUND"
  );
}

/**
 * Validates that model capabilities satisfy user and tool requirements.
 * @author Maruf Bepary
 */
export function validateModelCapabilities(params: {
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

/**
 * Extracts valid file attachment metadata with storage keys from chat history.
 * @author Maruf Bepary
 */
export function extractFileAttachments(thread: any[]) {
  return thread
    .flatMap((m) => m.attachments ?? [])
    .map((a: any) => ({ name: a.name, key: a.key, type: a.type }))
    .filter((a: any) => a.key);
}

/**
 * Resolves model provider for main chat generation.
 * @author Maruf Bepary
 */
export function resolveChatProvider(userId: string, model?: string) {
  return model
    ? resolveProvider(userId, model)
    : resolveDefaultChatProvider(userId);
}

/**
 * Resolves model provider for subagent workers if configured.
 * @author Maruf Bepary
 */
export function resolveWorkerChatProvider(
  userId: string,
  subagentModelId?: string,
) {
  if (!subagentModelId) {
    return Promise.resolve(null);
  }
  return resolveProvider(userId, subagentModelId).catch(() => null);
}

export interface ChatExecutionResourcesParams {
  userId: string;
  chatId: string;
  userMessageId: string;
  model?: string;
  subagentModelId?: string;
  selectedServerIds?: string[];
  selectedKbIds?: string[];
  selectedAssistantId?: string;
  selectedSkillIds?: string[];
}

/**
 * Concurrently loads user settings, model providers, chat context, and thread history.
 * @author Maruf Bepary
 */
export async function loadChatExecutionResources(
  params: ChatExecutionResourcesParams,
) {
  const [userSettings, resolved, workerResolved, ctx, thread] =
    await Promise.all([
      getUserSettingsByUserId(params.userId).catch(() => null),
      resolveChatProvider(params.userId, params.model),
      resolveWorkerChatProvider(params.userId, params.subagentModelId),
      loadChatContext(
        params.chatId,
        params.userId,
        params.selectedServerIds,
        params.selectedKbIds,
        params.selectedAssistantId,
        params.selectedSkillIds,
      ),
      loadThreadFromDb(params.chatId, params.userMessageId, params.userId),
    ]);

  return { userSettings, resolved, workerResolved, ctx, thread };
}

/**
 * Computes maximum tool step allowance for orchestrator.
 * @author Maruf Bepary
 */
export function resolveOrchestratorMaxSteps(
  isSubagentDelegationEnabled: boolean,
): number {
  return isSubagentDelegationEnabled
    ? Math.max(env.CHAT_MAX_STEPS * 2, 20)
    : env.CHAT_MAX_STEPS;
}

/**
 * Configures parameters for primary text streaming invocation.
 * @author Maruf Bepary
 */
export function buildStreamExecutionConfig(params: {
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
 * @author Maruf Bepary
 */
export function buildAssistantMessageMetadata({
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
 * @author Maruf Bepary
 */
export async function handleChatGenerationError(
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
