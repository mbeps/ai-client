import { isStepCount, type ModelMessage, streamText } from "ai";
import { env } from "@/config/env";
import { buildToolApproval } from "@/config/tool-approval";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import {
  collectStreamRound,
  type StreamAccumulator,
} from "@/lib/chat/collect-stream-round";
import { loadChatContext } from "@/lib/chat/load-chat-context";
import { loadThreadFromDb } from "@/lib/chat/load-thread-from-db";
import { prepareChatMessages } from "@/lib/chat/prepare-chat-messages";
import { registerFileUrlTool } from "@/lib/chat/register-file-url-tool";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
import { registerSkillAuthoringTools } from "@/lib/chat/register-skill-authoring-tools";
import { registerSkillTool } from "@/lib/chat/register-skill-tool";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import { checkVisionSupport } from "@/lib/chat/vision-guard";
import { ToolsNotSupportedError, VisionNotSupportedError } from "@/lib/errors";
import type { ChatStreamEvent } from "@/lib/inngest/channels";
import { getLogger } from "@/lib/logger";
import { getUserSettingsByUserId } from "@/lib/user/get-user-settings-by-id";
import type { ToolCall } from "@/types/chat/tool-call";
import type { ToolResult } from "@/types/chat/tool-result";
import type { ApprovalMode, PendingApproval } from "@/types/tool/approval";

const log = getLogger(["inngest", "chat", "response"]);

/** Result recorded when a tool never produced one before the round ended. */
const INTERRUPTED_RESULT = "Tool execution was interrupted";

/** Everything a single generation round needs. */
export interface GenerationInput {
  userId: string;
  userName: string;
  userEmail: string;
  chatId: string;
  userMessageId: string;
  /** Raw requested model. Absent means "use the user's default". */
  model?: string;
  approvalMode: ApprovalMode;
  selectedServerIds?: string[];
  selectedTools?: string[];
  selectedAssistantId?: string;
  selectedSkillIds?: string[];
  selectedKbIds?: string[];
  /** Approval pair appended after the prepared thread (resume rounds). */
  resumeMessages?: ModelMessage[];
  /** Approval rounds already consumed for this user message. */
  previousRound: number;
  abortSignal: AbortSignal;
  emit: (event: ChatStreamEvent) => Promise<void>;
}

/** Shared result shape. The caller decides how to persist or park it. */
interface GenerationResultBase {
  /** Model that actually ran, after defaulting. */
  modelId: string;
  content: string;
  reasoning: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  usage: unknown;
  finishReason?: string;
}

/** The model ran to completion. Nothing is waiting on the user. */
export interface GenerationDone extends GenerationResultBase {
  kind: "done";
}

/** The model stopped to ask for approval, so the round cannot finish yet. */
export interface GenerationAwaitingApproval extends GenerationResultBase {
  kind: "awaiting-approval";
  approvals: PendingApproval[];
  round: number;
}

/**
 * Runs exactly one round of generation. Loads context, registers tools, builds
 * the approval map, streams the model, and reports what happened.
 *
 * It never persists and never sends Inngest events, so it is testable without
 * either. `emit` is injected and the caller owns persistence, which is why an
 * aborted round can safely return what it accumulated instead of discarding it.
 *
 * @param input - Round context, approval policy, abort signal, and sink.
 * @returns The parked approvals, or the completed result.
 * @throws {VisionNotSupportedError} When the thread has images and the model cannot see.
 * @throws {ToolsNotSupportedError} When MCP tools are selected on a model that cannot call them.
 * @author Maruf Bepary
 */
export async function runChatGeneration(
  input: GenerationInput,
): Promise<GenerationDone | GenerationAwaitingApproval> {
  const {
    userId,
    userName,
    userEmail,
    chatId,
    userMessageId,
    model,
    approvalMode,
    selectedServerIds,
    selectedTools,
    selectedAssistantId,
    selectedSkillIds,
    selectedKbIds,
    resumeMessages,
    previousRound,
    abortSignal,
    emit,
  } = input;

  const [userSettings, resolved, ctx, thread] = await Promise.all([
    getUserSettingsByUserId(userId).catch(() => null),
    model ? resolveProvider(userId, model) : resolveDefaultChatProvider(userId),
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

  const { mcpTools, mcpCleanup } = await registerMcpTools(
    ctx.servers as never,
    selectedTools,
    selectedTools?.includes("internal:tool:manage_artifact") === true,
    ctx.activeKbId,
    ctx.kbIsReady,
    userId,
    ctx.activeKbIds,
  );

  try {
    const hasMcpTools = Object.keys(mcpTools).length > 0;
    const hasSkills = ctx.availableSkills.length > 0;
    const isToolCallingModel = !!resolved.modelRow.capTools;

    if (!checkVisionSupport(thread as never, !!resolved.modelRow.capVision)) {
      throw new VisionNotSupportedError();
    }
    if (!isToolCallingModel && hasMcpTools) {
      throw new ToolsNotSupportedError();
    }

    const fileAttachments = thread
      .flatMap((m) => m.attachments ?? [])
      .map((a) => ({ name: a.name, key: a.key, type: a.type }))
      .filter((a) => a.key);
    const hasFileAttachments = fileAttachments.length > 0;

    // Skill authoring is offered to every tool-calling model, even with no
    // skills yet, because creating the first one is the use case.
    const hasAnyTools =
      isToolCallingModel && (hasMcpTools || hasFileAttachments || hasSkills);

    const tools = hasAnyTools
      ? {
          ...(hasFileAttachments ? registerFileUrlTool(fileAttachments) : {}),
          ...(hasSkills ? registerSkillTool(userId) : {}),
          // Spread before the MCP tools so an MCP server cannot shadow an
          // internal tool by reusing its name.
          ...registerSkillAuthoringTools(userId),
          ...(hasMcpTools ? mcpTools : {}),
        }
      : {};

    // A tool absent from this map runs with no approval at all (V14), so it is
    // built from the registered set rather than from a curated list. It is
    // always passed, never undefined, so the gate cannot be skipped wholesale.
    const toolApproval = buildToolApproval(Object.keys(tools), approvalMode);

    const messages: ModelMessage[] = [
      ...prepareChatMessages({ history: thread }),
      ...(resumeMessages ?? []),
    ];

    const result = streamText({
      model: resolved.sdkProvider.chat(resolved.modelId),
      abortSignal,
      instructions: buildSystemPrompt(
        userSettings?.globalSystemPrompt,
        ctx.projectRow?.globalPrompt,
        ctx.assistantRow?.prompt,
        ctx.kbIsReady,
        {
          attachmentNames: fileAttachments.map((a) => a.name),
          availableSkills: ctx.availableSkills,
          selectedSkills: ctx.selectedSkills,
          supportsTools: isToolCallingModel,
          userContext: { name: userName, email: userEmail },
        },
      ),
      messages,
      tools,
      toolApproval,
      // Mandatory: without it any caller can forge an approval pair (V9).
      experimental_toolApprovalSecret: env.TOOL_APPROVAL_SECRET,
      stopWhen: hasAnyTools ? isStepCount(env.CHAT_MAX_STEPS) : undefined,
    });

    // Awaited only after the loop. Resolving these promises early would
    // deadlock, because the model has not finished until the stream is drained.
    const finishReasonPromise = Promise.resolve(result.finishReason).catch(
      () => "stop",
    );
    const usagePromise = Promise.resolve(result.usage).catch(() => undefined);

    // A resume re-invokes the model, so a model that keeps re-requesting the
    // same tool would otherwise loop forever (V13).
    const roundCapped = previousRound >= env.CHAT_MAX_APPROVAL_ROUNDS;
    const round = previousRound + 1;

    const accumulator: StreamAccumulator = {
      content: "",
      reasoning: "",
      calls: [],
      blockedCallIds: new Set<string>(),
      approvals: [],
    };

    /** Drops blocked calls, which the SDK never ran, from both views. */
    const settled = () =>
      accumulator.calls.filter(
        (c) => !accumulator.blockedCallIds.has(c.toolCallId),
      );

    const snapshot = (): GenerationResultBase => ({
      modelId: resolved.modelId,
      content: accumulator.content,
      reasoning: accumulator.reasoning,
      toolCalls: settled().map(({ toolCallId, toolName, args }) => ({
        toolCallId,
        toolName,
        args,
      })),
      toolResults: settled().map((c) => ({
        toolCallId: c.toolCallId,
        toolName: c.toolName,
        result:
          c.result !== undefined ? c.result : { error: INTERRUPTED_RESULT },
      })),
      usage: undefined,
    });

    const { aborted } = await collectStreamRound(result, accumulator, emit, {
      abortSignal,
      chatId,
      round,
      roundCapped,
    });

    if (aborted) {
      return { kind: "done", ...snapshot() };
    }
    if (abortSignal.aborted) {
      log.info("Chat generation cleanly aborted by user (chatId: {chatId})", {
        chatId,
      });
      return { kind: "done", ...snapshot() };
    }
    if (accumulator.approvals.length > 0) {
      return {
        kind: "awaiting-approval",
        ...snapshot(),
        usage: await usagePromise,
        finishReason: await finishReasonPromise,
        approvals: accumulator.approvals,
        round,
      };
    }
    return {
      kind: "done",
      ...snapshot(),
      usage: await usagePromise,
      finishReason: await finishReasonPromise,
    };
  } finally {
    await mcpCleanup();
  }
}
