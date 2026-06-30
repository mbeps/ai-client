import type { AiModelRow } from "./ai-model-row";

/**
 * AI model record extended with provider metadata for UI display.
 * Combines model details with provider information (name, enabled status)
 * for efficient rendering in model selection dropdowns without separate queries
.
 *
 * @author Maruf Bepary
 */
export type AiModelWithProvider = AiModelRow & {
  providerName: string;
  providerIsEnabled: boolean;
};
