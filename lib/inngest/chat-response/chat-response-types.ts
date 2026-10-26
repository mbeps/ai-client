import type { ModelMessage } from "ai";
import type { ChatStreamEvent } from "@/lib/inngest/chat-channel";

export interface CompletedToolRecord {
  toolCallId: string;
  toolName: string;
  args: any;
  result?: any;
  serverName?: string;
}

export interface BuildOrchestratorToolSetParams {
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
  resolved: any;
  resolvedModelId: string;
  workerResolved: any;
}

export interface OrchestratorToolSetResult {
  orchestratorActiveTools: Record<string, any>;
  subagentDispatchTools: Record<string, any>;
  allTools?: Record<string, any>;
  hasAnyTools: boolean;
  hasKbTool: boolean;
  hasArtifactTool: boolean;
  artifactTools: Record<string, any>;
  isSubagentDelegationEnabled: boolean;
}

export interface SynthesisFallbackParams {
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

export interface ConsumeModelStreamResult {
  accumulatedText: string;
  accumulatedReasoning: string;
  aborted: boolean;
}
