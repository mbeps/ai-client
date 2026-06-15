import type { AiModelRow } from "@/types/ai-model-row";

/**
 * Legacy capability labels used by static migration seed models.
 */
export type LegacyModelCapability = "vision" | "tool-calling" | "json-output";

/**
 * Legacy static model shape used only by migration seed utilities.
 */
export interface LegacyModel {
  label: string;
  value: string;
  provider?: string;
  contextWindow?: number;
  capabilities?: LegacyModelCapability[];
  isThinking?: boolean;
}

// Backward-compatible aliases used by legacy runtime-seed modules.
export type Model = LegacyModel;
export type ModelCapability = LegacyModelCapability;

/**
 * Provider-registry model capability flags backed by ai_model booleans.
 */
export type ProviderModelCapability =
  | "tools"
  | "vision"
  | "reasoning"
  | "structured_output";

/**
 * Checks a capability directly from ai_model boolean flags.
 */
export function hasProviderCapability(
  model: AiModelRow,
  capability: ProviderModelCapability,
): boolean {
  if (capability === "tools") return model.capTools;
  if (capability === "vision") return model.capVision;
  if (capability === "reasoning") return model.capReasoning;
  return model.capStructuredOutput;
}
