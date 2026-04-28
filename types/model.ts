/**
 * Represents an available AI model for use in chat requests.
 * Each model is a provider-specific model ID with a human-readable label.
 * Models are configured externally (via environment or config) and used to select
 * which LLM receives the chat prompt (e.g., OpenAI gpt-4, Anthropic Claude).
 *
 * @see Chat for the chat context where models are selected
 * @see AppState for the store managing selected model state
 * @author Maruf Bepary
 */
export interface Model {
  /** Human-readable display name for the model (e.g., "GPT-4 Turbo", "Claude 3 Opus"). */
  label: string;

  /** Provider-specific model identifier (e.g., "gpt-4-turbo", "claude-3-opus-20240229"). */
  value: string;
}
