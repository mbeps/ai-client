import { isStepCount, streamText } from "ai";
import { env } from "@/config/env";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";
import { chatAbortRegistry } from "@/lib/chat/chat-abort-registry";
import { loadChatContext } from "@/lib/chat/load-chat-context";
import { loadThreadFromDb } from "@/lib/chat/load-thread-from-db";
import { persistAssistantResponse } from "@/lib/chat/persist-response";
import { prepareChatMessages } from "@/lib/chat/prepare-chat-messages";
import { registerArtifactTool } from "@/lib/chat/register-artifact-tool";
import { registerFileUrlTool } from "@/lib/chat/register-file-url-tool";
import { registerKnowledgebaseTool } from "@/lib/chat/register-knowledgebase-tool";
import { registerMcpTools } from "@/lib/chat/register-mcp-tools";
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

      const [userSettings, resolved, ctx, thread] = await Promise.all([
        getUserSettingsByUserId(userId).catch(() => null),
        model
          ? resolveProvider(userId, model)
          : resolveDefaultChatProvider(userId),
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

      const hasSkills = isToolCallingModel && ctx.availableSkills.length > 0;

      // Skill authoring is gated on model tool support AND tool selection (item 5)
      const hasSkillAuthoring =
        isToolCallingModel &&
        (selectedTools === undefined ||
          selectedTools.includes(INTERNAL_TOOL_IDS.MANAGE_SKILL));

      const hasAnyTools =
        isToolCallingModel &&
        (hasExternalMcpTools ||
          hasArtifactTool ||
          hasKbTool ||
          hasFileAttachments ||
          hasSkills ||
          hasSkillAuthoring);

      const result = streamText({
        model: resolved.sdkProvider.chat(resolvedModelId),
        abortSignal: abortController.signal,
        instructions: buildSystemPrompt(
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
          },
        ),
        messages: finalMessages,
        tools: hasAnyTools
          ? {
              // External MCP tools spread FIRST so internal tools cannot be shadowed
              ...(hasExternalMcpTools ? mcpTools : {}),
              ...(hasArtifactTool ? artifactTools : {}),
              ...(hasKbTool ? kbTools : {}),
              ...(hasSkills ? registerSkillTool(userId) : {}),
              ...(hasSkillAuthoring ? registerSkillAuthoringTools(userId) : {}),
              ...(hasFileAttachments
                ? registerFileUrlTool(fileAttachments)
                : {}),
            }
          : undefined,
        stopWhen: hasAnyTools ? isStepCount(env.CHAT_MAX_STEPS) : undefined,
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
          const tc = completedTools.find(
            (t) => t.toolCallId === chunk.toolCallId,
          );
          if (tc) {
            tc.result = (chunk as any).result ?? (chunk as any).output;
          }
          await emit({
            type: "tool-result",
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            result: (chunk as any).result ?? (chunk as any).output,
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

      // Persist completed assistant message to database
      await persistAssistantResponse({
        chatId,
        assistantMessageId,
        content: accumulatedText,
        parentId: userMessageId,
        metadata,
      });

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
