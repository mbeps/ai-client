import type { UserModelOption } from "@/hooks/use-user-models";
import type { Attachment } from "@/types/attachment/attachment";
import type { Message } from "@/types/message/message";
import { parseMessageMetadata } from "./parse-message-metadata";

export interface ContextCategoryBreakdown {
  systemInstructions: number;
  toolDefinitions: number;
  messages: number;
  files: number;
  toolResults: number;
  draft: number;
}

export interface ContextUsageResult {
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  displayPercentage: string;
  breakdown: ContextCategoryBreakdown;
  isNearLimit: boolean;
  isExceeded: boolean;
}

export interface CalculateContextParams {
  thread?: Message[];
  selectedModel?: UserModelOption;
  input?: string;
  draftAttachments?: Attachment[];
  systemPrompt?: string;
  toolNames?: string[];
  mcpServerCount?: number;
}

/**
 * Estimates token count for a text string using standard ~3.8 chars/token rule of thumb.
 *
 * @param text - The string to estimate tokens for
 * @returns Estimated token count (minimum 0)
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / 3.8);
}

/**
 * Estimates token count for an attachment.
 * Text files use string length estimation; images/binary use fixed vision tile estimates (~800 tokens).
 *
 * @param attachment - The attachment to estimate
 * @returns Estimated token count
 */
export function estimateAttachmentTokens(attachment: Attachment): number {
  if (attachment.type === "image") {
    return 800;
  }
  if (attachment.extractedText) {
    return estimateTokens(attachment.extractedText);
  }
  if (attachment.sizeBytes) {
    // Approx 1 token per 4 bytes of raw text
    return Math.ceil(attachment.sizeBytes / 4);
  }
  return 100;
}

/**
 * Formats a token count into a human-friendly string (e.g. 850, 12.4K, 371.5K, 1M).
 *
 * @param tokens - The raw token number
 * @returns Formatted token string
 */
export function formatTokens(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toLocaleString();
  }
  if (tokens < 1_000_000) {
    const k = tokens / 1000;
    const formatted =
      k >= 100 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, "");
    return `${formatted}K`;
  }
  const m = tokens / 1_000_000;
  const formatted =
    m >= 10 ? Math.round(m).toString() : m.toFixed(1).replace(/\.0$/, "");
  return `${formatted}M`;
}

/**
 * Calculates the total context window usage and category breakdown for the active chat session.
 *
 * @param params - Input parameters including thread, model, draft input, and attachments
 * @returns Aggregated context usage statistics and category breakdowns
 * @author Maruf Bepary
 */
export function calculateContextUsage(
  params: CalculateContextParams,
): ContextUsageResult {
  const {
    thread = [],
    selectedModel,
    input = "",
    draftAttachments = [],
    systemPrompt = "",
    toolNames = [],
    mcpServerCount = 0,
  } = params;

  // 1. Context Window Limit (default 128K if not provided)
  const maxTokens = selectedModel?.contextWindow || 128_000;

  // 2. System Instructions
  // Base instructions + assistant/global system prompts
  const baseSystemTokens = estimateTokens(systemPrompt) || 120; // Default baseline prompt overhead
  const systemInstructions = baseSystemTokens;

  // 3. Tool Definitions
  // Each active tool schema averages ~150-250 tokens in JSON schema definition
  const toolSchemaTokens = toolNames.length * 180;
  const serverOverheadTokens = mcpServerCount * 50;
  const toolDefinitions = toolSchemaTokens + serverOverheadTokens;

  // 4. Thread Messages
  let messagesTokens = 0;
  let filesTokens = 0;
  let toolResultsTokens = 0;

  for (const msg of thread) {
    // Message text
    messagesTokens += estimateTokens(msg.content);

    // Attachments on message
    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        filesTokens += estimateAttachmentTokens(att);
      }
    }

    // Tool results and reasoning from metadata
    if (msg.metadata) {
      const parsed = parseMessageMetadata(msg.metadata);
      if (parsed.reasoning) {
        messagesTokens += estimateTokens(parsed.reasoning);
      }
      if (parsed.toolData?.toolCalls) {
        for (const tc of parsed.toolData.toolCalls) {
          toolResultsTokens += estimateTokens(
            typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args),
          );
        }
      }
      if (parsed.toolData?.toolResults) {
        for (const tr of parsed.toolData.toolResults) {
          toolResultsTokens += estimateTokens(
            typeof tr.result === "string"
              ? tr.result
              : JSON.stringify(tr.result),
          );
        }
      }
    }
  }

  // 5. Draft Input & Attachments
  let draftTokens = estimateTokens(input);
  for (const att of draftAttachments) {
    draftTokens += estimateAttachmentTokens(att);
  }

  // 6. Totals & Percentages
  const totalTokens =
    systemInstructions +
    toolDefinitions +
    messagesTokens +
    filesTokens +
    toolResultsTokens +
    draftTokens;

  const rawPercent = (totalTokens / maxTokens) * 100;
  const percentage = Math.min(100, Math.round(rawPercent));

  let displayPercentage = `${percentage}%`;
  if (totalTokens > 0 && percentage === 0) {
    displayPercentage = "< 1%";
  }

  const isNearLimit = rawPercent >= 75;
  const isExceeded = rawPercent >= 100;

  return {
    totalTokens,
    maxTokens,
    percentage,
    displayPercentage,
    breakdown: {
      systemInstructions,
      toolDefinitions,
      messages: messagesTokens,
      files: filesTokens,
      toolResults: toolResultsTokens,
      draft: draftTokens,
    },
    isNearLimit,
    isExceeded,
  };
}
