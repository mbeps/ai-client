import { MODELS } from "@/constants/models";

export type LegacyUserSettingsRow = {
  id: string;
  userId: string;
  openrouterKey: string | null;
  defaultChatModelId: string | null;
  defaultEmbeddingModelId: string | null;
};

export type SeedModelCandidate = {
  modelId: string;
  label: string;
  contextWindow: number;
  capTools: boolean;
  capVision: boolean;
  capReasoning: boolean;
  capStructuredOutput: boolean;
};

/**
 * Converts legacy static models into provider-registry seed candidates.
 * Includes the historical embedding model used by RAG to bootstrap defaults.
 */
export function buildLegacySeedModels(): SeedModelCandidate[] {
  const chatModels = MODELS.map((model) => ({
    modelId: model.value,
    label: model.label,
    contextWindow: model.contextWindow ?? 4096,
    capTools: model.capabilities?.includes("tool-calling") ?? false,
    capVision: model.capabilities?.includes("vision") ?? false,
    capReasoning: model.isThinking ?? false,
    capStructuredOutput: model.capabilities?.includes("json-output") ?? false,
  }));

  const embeddingFallback: SeedModelCandidate = {
    modelId: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    label: "Llama Nemotron Embed VL 1B V2",
    contextWindow: 8192,
    capTools: false,
    capVision: false,
    capReasoning: false,
    capStructuredOutput: false,
  };

  const byModelId = new Map<string, SeedModelCandidate>();

  for (const model of chatModels) {
    byModelId.set(model.modelId, model);
  }

  if (!byModelId.has(embeddingFallback.modelId)) {
    byModelId.set(embeddingFallback.modelId, embeddingFallback);
  }

  return Array.from(byModelId.values());
}

export type SeedPlan = {
  defaultChatModelKey: string;
  defaultEmbeddingModelKey: string;
};

/**
 * Chooses stable model keys for default model pointers during migration.
 * Existing defaults win; otherwise falls back to known-safe seeded entries.
 */
export function createSeedPlan(
  settings: LegacyUserSettingsRow,
  candidates: SeedModelCandidate[],
): SeedPlan {
  const fallbackChat = candidates[0]?.modelId ?? null;
  const fallbackEmbedding =
    candidates.find(
      (candidate) =>
        candidate.modelId === "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    )?.modelId ?? fallbackChat;

  if (!fallbackChat || !fallbackEmbedding) {
    throw new Error(
      "No candidate models available for provider seed migration",
    );
  }

  const preferredChatModel = "openai/gpt-oss-120b:free";
  const chatModelExists = candidates.some(
    (candidate) => candidate.modelId === preferredChatModel,
  );

  return {
    defaultChatModelKey: settings.defaultChatModelId
      ? settings.defaultChatModelId
      : chatModelExists
        ? preferredChatModel
        : fallbackChat,
    defaultEmbeddingModelKey: settings.defaultEmbeddingModelId
      ? settings.defaultEmbeddingModelId
      : fallbackEmbedding,
  };
}
