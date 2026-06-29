import { createOpenAI } from "@ai-sdk/openai";
import { ProviderNotConfiguredError } from "@/lib/constants/errors";

/**
 * Builds an initialized OpenAI-compatible SDK provider instance.
 * Validates API key is present before initializing the provider.
 *
 * @param input - Provider configuration with name, baseURL, apiKey, and headers
 * @returns Initialized OpenAI SDK provider instance
 * @throws {ProviderNotConfiguredError} When API key is missing or empty
 * @author Maruf Bepary
 */
export function buildSdkProvider(input: {
  providerName: string;
  baseUrl: string;
  apiKey: string | null;
  headers: Record<string, string>;
}) {
  if (!input.apiKey) {
    throw new ProviderNotConfiguredError(
      `API key not configured for provider: ${input.providerName}. Configure it in Settings → Providers.`,
    );
  }

  return createOpenAI({
    baseURL: input.baseUrl,
    apiKey: input.apiKey,
    headers: input.headers,
  });
}
