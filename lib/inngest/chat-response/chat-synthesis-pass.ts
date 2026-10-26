import { isStepCount, type ModelMessage, streamText } from "ai";
import type { SynthesisFallbackParams } from "@/lib/inngest/chat-response/chat-response-types";
import { consumeModelStream } from "@/lib/inngest/chat-response/chat-stream-consumer";
import { getLogger } from "@/lib/logger";

const log = getLogger(["inngest", "chat", "response"]);

/**
 * Evaluates whether fallback synthesis pass should run.
 * @author Maruf Bepary
 */
export function needsFallbackSynthesis(
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
 * @author Maruf Bepary
 */
export async function runSynthesisFallbackPass(
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
