import type { UserModelOption } from "@/hooks/use-user-models";
import { estimateAttachmentTokens } from "@/lib/chat/estimate-attachment-tokens";
import { estimateTokens } from "@/lib/chat/estimate-tokens";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { sanitizeSubagentOutput } from "@/lib/subagents/subagent-dispatch-tool";
import type { Attachment } from "@/types/attachment/attachment";
import type { Message } from "@/types/message/message";

export interface ContextCategoryBreakdown {
  systemInstructions: number;
  toolDefinitions: number;
  skills: number;
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
  /** Estimated tokens for fully-injected selected skill content (content + bundled files). */
  selectedSkillTokens?: number;
  /** Number of available skills listed in the catalog (lightweight progressive disclosure). */
  availableSkillCount?: number;
}

/**
 * Calculates the total context window usage and category breakdown for the active chat session.
 *
 * @param params - Input parameters including thread, model, draft input, and attachments
 * @returns Aggregated context usage statistics and category breakdowns
 * @author Maruf Bepary
 */
function estimateSingleToolResultTokens(tr: {
  toolName?: string;
  result?: unknown;
}): number {
  if (tr.toolName === "delegate_task" || tr.toolName === "subagent_dispatch") {
    return estimateTokens(sanitizeSubagentOutput(tr.result, 8000));
  }
  if (tr.toolName === "manage_artifact") {
    const artTitle =
      (tr.result as { artifact?: { title?: string } } | undefined)?.artifact
        ?.title || "Artifact";
    return estimateTokens(`Artifact "${artTitle}" created successfully.`);
  }
  const rawStr =
    typeof tr.result === "string" ? tr.result : JSON.stringify(tr.result);
  // Cap estimate to bounded representation (max 8000 chars)
  return estimateTokens(rawStr.slice(0, 8000));
}

function estimateToolCallsTokens(toolCalls?: Array<{ args: unknown }>): number {
  if (!toolCalls) return 0;
  let tokens = 0;
  for (const tc of toolCalls) {
    tokens += estimateTokens(
      typeof tc.args === "string" ? tc.args : JSON.stringify(tc.args),
    );
  }
  return tokens;
}

function estimateToolResultsTokens(
  toolResults?: Array<{ toolName?: string; result?: unknown }>,
): number {
  if (!toolResults) return 0;
  let tokens = 0;
  for (const tr of toolResults) {
    tokens += estimateSingleToolResultTokens(tr);
  }
  return tokens;
}

function estimateMessageMetadataTokens(metadata: string | null | undefined): {
  reasoningTokens: number;
  toolResultsTokens: number;
} {
  if (!metadata) {
    return { reasoningTokens: 0, toolResultsTokens: 0 };
  }

  const parsed = parseMessageMetadata(metadata);
  const reasoningTokens = parsed.reasoning
    ? estimateTokens(parsed.reasoning)
    : 0;
  const toolResultsTokens =
    estimateToolCallsTokens(parsed.toolData?.toolCalls) +
    estimateToolResultsTokens(parsed.toolData?.toolResults);

  return { reasoningTokens, toolResultsTokens };
}

function estimateMessageThreadTokens(thread: Message[]): {
  messagesTokens: number;
  filesTokens: number;
  toolResultsTokens: number;
} {
  let messagesTokens = 0;
  let filesTokens = 0;
  let toolResultsTokens = 0;

  for (const msg of thread) {
    messagesTokens += estimateTokens(msg.content);

    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        filesTokens += estimateAttachmentTokens(att);
      }
    }

    const metaTokens = estimateMessageMetadataTokens(msg.metadata);
    messagesTokens += metaTokens.reasoningTokens;
    toolResultsTokens += metaTokens.toolResultsTokens;
  }

  return { messagesTokens, filesTokens, toolResultsTokens };
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
    selectedSkillTokens = 0,
    availableSkillCount = 0,
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

  // 4. Skills
  // Selected skills are fully injected into the system prompt (content + bundled files).
  // Available (unselected) skills appear as a lightweight catalog (~50 tokens each).
  const catalogTokens = availableSkillCount * 50;
  const skillsTokens = selectedSkillTokens + catalogTokens;

  // 5. Thread Messages
  const { messagesTokens, filesTokens, toolResultsTokens } =
    estimateMessageThreadTokens(thread);

  // 6. Draft Input & Attachments
  let draftTokens = estimateTokens(input);
  for (const att of draftAttachments) {
    draftTokens += estimateAttachmentTokens(att);
  }

  // 7. Totals & Percentages
  const totalTokens =
    systemInstructions +
    toolDefinitions +
    skillsTokens +
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
      skills: skillsTokens,
      messages: messagesTokens,
      files: filesTokens,
      toolResults: toolResultsTokens,
      draft: draftTokens,
    },
    isNearLimit,
    isExceeded,
  };
}
