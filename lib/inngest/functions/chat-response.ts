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

    const emit = async (data: ChatStreamEvent) => {
      if (abortController.signal.aborted) return;
      try {
        await inngest.realtime.publish(ch.stream, data);
      } catch (err) {
        log.warn("Failed to publish chat stream event to Inngest Realtime", {
          error: err instanceof Error ? err.message : String(err),
          type: data.type,
        });
      }
    };

    let mcpCleanup: () => Promise<void> = async () => {};

    try {
      await emit({ type: "start", messageId: assistantMessageId });

      const [userSettings, resolved, workerResolved, ctx, thread] =
        await Promise.all([
          getUserSettingsByUserId(userId).catch(() => null),
          model
            ? resolveProvider(userId, model)
            : resolveDefaultChatProvider(userId),
          subagentModelId
            ? resolveProvider(userId, subagentModelId).catch(() => null)
            : Promise.resolve(null),
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

      const isArtifactToolSelected =
        selectedTools === undefined ||
        selectedTools.includes(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT);

      const { mcpTools, mcpCleanup: registeredCleanup } =
        await registerMcpTools(ctx.servers as any, selectedTools);
      mcpCleanup = registeredCleanup;

      const hasExternalMcpTools = Object.keys(mcpTools).length > 0;
      const isToolCallingModel = !!resolvedModelRow?.capTools;

      // If user explicitly requested external MCP tools but model lacks tool capability, throw
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

      if (!checkVisionSupport(thread as any, !!resolvedModelRow?.capVision)) {
        throw new VisionNotSupportedError();
      }

      const fileAttachments = thread
        .flatMap((m) => m.attachments ?? [])
        .map((a) => ({ name: a.name, key: a.key, type: a.type }))
        .filter((a) => a.key);
      const hasFileAttachments = fileAttachments.length > 0;

      const finalMessages = prepareChatMessages({ history: thread });

      // Target knowledge base IDs
      const targetKbIds =
        ctx.activeKbIds && ctx.activeKbIds.length > 0
          ? ctx.activeKbIds
          : ctx.activeKbId
            ? [ctx.activeKbId]
            : [];

      // Internal tools registration
      const kbTools = isToolCallingModel
        ? registerKnowledgebaseTool(
            targetKbIds,
            ctx.kbIsReady,
            userId,
            selectedTools,
          )
        : {};
      const hasKbTool = Object.keys(kbTools).length > 0;

      const artifactTools =
        isToolCallingModel && isArtifactToolSelected
          ? registerArtifactTool()
          : {};
      const hasArtifactTool = Object.keys(artifactTools).length > 0;

      const memoryTools =
        isToolCallingModel && isMemoryEnabled
          ? registerMemoryTool(userId, selectedTools)
          : {};
      const hasMemoryTool = Object.keys(memoryTools).length > 0;

      const hasSkills = isToolCallingModel && ctx.availableSkills.length > 0;

      // Skill authoring is gated on model tool support AND tool selection (item 5)
      const hasSkillAuthoring =
        isToolCallingModel &&
        (selectedTools === undefined ||
          selectedTools.includes(INTERNAL_TOOL_IDS.MANAGE_SKILL));

      const isSubagentDelegationEnabled =
        isToolCallingModel &&
        (subagentsEnabled === true ||
          selectedTools?.includes(INTERNAL_TOOL_IDS.DELEGATE_TASK));

      // Scratchpad tools for shared blackboard file persistence (only active when subagent delegation is enabled)
      const scratchpadTools: Record<string, any> = isSubagentDelegationEnabled
        ? registerScratchpadTools({
            chatId,
            messageId: assistantMessageId,
            workerRole: "orchestrator",
          })
        : {};

      // Active orchestrator tools that the main agent is using and subagents inherit
      const orchestratorActiveTools: Record<string, any> = {
        ...(hasExternalMcpTools ? mcpTools : {}),
        ...(hasArtifactTool ? artifactTools : {}),
        ...(hasMemoryTool ? memoryTools : {}),
        ...(hasKbTool ? kbTools : {}),
        ...(hasSkills ? registerSkillTool(userId) : {}),
        ...(hasSkillAuthoring ? registerSkillAuthoringTools(userId) : {}),
        ...(hasFileAttachments ? registerFileUrlTool(fileAttachments) : {}),
        ...scratchpadTools,
      };

      const subagentDispatchTools: Record<string, any> =
        isSubagentDelegationEnabled
          ? {
              delegate_task: createSubagentDispatchTool({
                defaultModel: resolved.sdkProvider.chat(resolvedModelId),
                customWorkerModel: workerResolved
                  ? workerResolved.sdkProvider.chat(workerResolved.modelId)
                  : undefined,
                availableTools: orchestratorActiveTools,
                excludedTools: subagentExcludedTools,
                maxSteps: env.CHAT_MAX_STEPS,
              }),
            }
          : {};

      const hasAnyTools =
        isToolCallingModel &&
        (hasExternalMcpTools ||
          hasArtifactTool ||
          hasMemoryTool ||
          hasKbTool ||
          hasFileAttachments ||
          hasSkills ||
          hasSkillAuthoring ||
          isSubagentDelegationEnabled);

      const orchestratorMaxSteps = isSubagentDelegationEnabled
        ? Math.max(env.CHAT_MAX_STEPS * 2, 20)
        : env.CHAT_MAX_STEPS;

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

      const result = streamText({
        model: resolved.sdkProvider.chat(resolvedModelId),
        abortSignal: abortController.signal,
        instructions: systemPrompt,
        messages: finalMessages,
        tools: hasAnyTools
          ? {
              ...orchestratorActiveTools,
              ...subagentDispatchTools,
            }
          : undefined,
        stopWhen: hasAnyTools ? isStepCount(orchestratorMaxSteps) : undefined,
      });

      const safeFinishReason = Promise.resolve(result.finishReason).catch(
        () => "stop",
      );
      const safeUsage = Promise.resolve(result.usage).catch(() => undefined);

      let accumulatedText = "";
      let accumulatedReasoning = "";
      const completedTools: Array<{
        toolCallId: string;
        toolName: string;
        args: any;
        result?: any;
      }> = [];

      for await (const chunk of result.fullStream) {
        if (abortController.signal.aborted) {
          log.info("Stream loop aborted by user (chatId: {chatId})", {
            chatId,
          });
          return;
        }
        if (chunk.type === "text-delta") {
          accumulatedText += chunk.text;
          await emit({ type: "text-delta", text: chunk.text });
        } else if (chunk.type === "reasoning-delta") {
          accumulatedReasoning += chunk.text;
          await emit({ type: "reasoning-delta", reasoning: chunk.text });
        } else if (chunk.type === "tool-call") {
          completedTools.push({
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            args: (chunk as any).args ?? (chunk as any).input,
          });
          await emit({
            type: "tool-call",
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            args: (chunk as any).args ?? (chunk as any).input,
          });
        } else if (chunk.type === "tool-result") {
          const isPreliminary = Boolean((chunk as any).preliminary);
          const rawResult = (chunk as any).result ?? (chunk as any).output;
          const tc = completedTools.find(
            (t) => t.toolCallId === chunk.toolCallId,
          );
          const isSubagent =
            chunk.toolName === "delegate_task" ||
            chunk.toolName === INTERNAL_TOOL_IDS.DELEGATE_TASK;
          const finalResult = isSubagent
            ? sanitizeSubagentOutput(rawResult)
            : rawResult;

          if (tc && !isPreliminary) {
            tc.result = finalResult;
          }
          await emit({
            type: "tool-result",
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            result: isPreliminary ? rawResult : finalResult,
            preliminary: isPreliminary,
          });
        } else if (chunk.type === "tool-error") {
          const tc = completedTools.find(
            (t) => t.toolCallId === chunk.toolCallId,
          );
          const rawErr = (chunk as any).error;
          const errorMsg =
            rawErr instanceof Error
              ? rawErr.message
              : typeof rawErr === "string"
                ? rawErr
                : JSON.stringify(rawErr ?? "Tool execution failed");
          const errorResult = { error: errorMsg };
          if (tc) {
            tc.result = errorResult;
          }
          await emit({
            type: "tool-result",
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            result: errorResult,
          });
        }
      }

      // Synthesis fallback: if tools completed but no text was produced
      // (e.g., hit step limit or model stopped on tool-calls turn), synthesize a final response
      if (
        !abortController.signal.aborted &&
        accumulatedText.trim().length === 0 &&
        completedTools.length > 0
      ) {
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

          for await (const chunk of synthResult.fullStream) {
            if (abortController.signal.aborted) break;
            if (chunk.type === "text-delta") {
              accumulatedText += chunk.text;
              await emit({ type: "text-delta", text: chunk.text });
            } else if (chunk.type === "reasoning-delta") {
              accumulatedReasoning += chunk.text;
              await emit({ type: "reasoning-delta", reasoning: chunk.text });
            } else if (chunk.type === "tool-call") {
              completedTools.push({
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: (chunk as any).args ?? (chunk as any).input,
              });
              await emit({
                type: "tool-call",
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                args: (chunk as any).args ?? (chunk as any).input,
              });
            } else if (chunk.type === "tool-result") {
              const rawResult = (chunk as any).result ?? (chunk as any).output;
              const tc = completedTools.find(
                (t) => t.toolCallId === chunk.toolCallId,
              );
              if (tc) {
                tc.result = rawResult;
              }
              await emit({
                type: "tool-result",
                toolCallId: chunk.toolCallId,
                toolName: chunk.toolName,
                result: rawResult,
                preliminary: false,
              });
            }
          }
        } catch (synthErr) {
          log.warn("Synthesis fallback pass encountered error: {error}", {
            error:
              synthErr instanceof Error ? synthErr.message : String(synthErr),
          });
        }
      }

      if (abortController.signal.aborted) {
        log.info("Chat generation cleanly aborted by user (chatId: {chatId})", {
          chatId,
        });
        return;
      }

      const finishReason = await safeFinishReason;
      const usage = await safeUsage;

      const metadata = JSON.stringify({
        model: resolvedModelId,
        reasoning: accumulatedReasoning,
        toolCalls: completedTools.map((tc) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        })),
        toolResults: completedTools.map((tc) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          result:
            tc.result !== undefined
              ? tc.result
              : { error: "Tool execution was interrupted" },
        })),
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
      if (
        abortController.signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        log.info("Chat generation cleanly aborted by user (chatId: {chatId})", {
          chatId,
        });
        return;
      }
      if (
        error instanceof ChatNotFoundError ||
        (error as Record<string, unknown> | null)?.code === "CHAT_NOT_FOUND"
      ) {
        log.info(
          "Chat generation cleanly aborted or chat not found (chatId: {chatId})",
          { chatId },
        );
        return;
      }
      const classified = classifyProviderError(error);
      const effectiveError = classified ?? error;
      const errorMsg =
        effectiveError instanceof Error
          ? effectiveError.message
          : "Generation failed";
      const errorCode = (effectiveError as any)?.code;
      log.error(
        "Chat generation failed in Inngest (chatId: {chatId}): {error}",
        {
          chatId,
          error: errorMsg,
        },
      );
      await emit({ type: "error", message: errorMsg, code: errorCode });
      throw error;
    } finally {
      releaseAbortController();
      await mcpCleanup();
    }
  },
);
