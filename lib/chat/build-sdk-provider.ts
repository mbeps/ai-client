import { createOpenAI } from "@ai-sdk/openai";
import { ProviderNotConfiguredError } from "@/constants/errors";

/**
 * Builds an initialized OpenAI-compatible SDK provider instance.
 * Validates API key is present before initializing the provider, unless the
 * provider is explicitly keyless (`requiresKey: false`, e.g. Ollama).
 *
 * @param input - Provider configuration with name, baseURL, apiKey, requiresKey, and headers
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
}) {
  if (input.requiresKey !== false && !input.apiKey) {
    throw new ProviderNotConfiguredError(
      `API key not configured for provider: ${input.providerName}. Configure it in Settings → Providers.`,
    );
  }

  return createOpenAI({
    baseURL: input.baseUrl,
    apiKey: input.apiKey ?? undefined,
    headers: input.headers,
  });
}
