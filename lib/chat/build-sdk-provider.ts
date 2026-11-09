import { createOpenAI } from "@ai-sdk/openai";
import { createReasoningNormalizingFetch } from "@/lib/chat/stream/reasoning-stream-parser";
import { ProviderNotConfiguredError } from "@/lib/error/provider-not-configured-error";
import type {
  ReasoningEffort,
  ReasoningEffortFormat,
} from "@/schemas/providers/provider-registry";

/**
 * Builds an initialized OpenAI-compatible SDK provider instance.
 * Validates API key is present before initializing the provider, unless the
 * provider is explicitly keyless (`requiresKey: false`, e.g. Ollama).
 * Injects reasoning-normalizing fetch wrapper for generic reasoning stream handling.
 *
 * @param input - Provider configuration with name, baseURL, apiKey, requiresKey, headers, and reasoning traits
 * @returns Initialized OpenAI SDK provider instance
 * @throws {ProviderNotConfiguredError} When API key is missing or empty and requiresKey is not false
 * @author Maruf Bepary
 */
export function buildSdkProvider(input: {
  providerName: string;
  baseUrl: string;
  apiKey: string | null;
  requiresKey?: boolean;
  headers: Record<string, string>;
  reasoningEffortFormat?: ReasoningEffortFormat;
  reasoningEffort?: ReasoningEffort;
  modelOptions?: Record<string, unknown> | null;
  fetch?: typeof fetch;
}) {
  if (input.requiresKey !== false && !input.apiKey) {
    throw new ProviderNotConfiguredError(
      `API key not configured for provider: ${input.providerName}. Configure it in Settings → Providers.`,
    );
  }

  const customFetch = createReasoningNormalizingFetch({
    reasoningEffortFormat: input.reasoningEffortFormat,
    reasoningEffort: input.reasoningEffort,
    modelOptions: input.modelOptions,
    baseFetch: input.fetch,
  });

  return createOpenAI({
    baseURL: input.baseUrl,
    apiKey: input.apiKey ?? undefined,
    headers: input.headers,
    fetch: customFetch,
  });
}
