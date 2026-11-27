import {
  getProviderDefinition,
  type ProviderDiscoveryResponseFormat,
} from "@/config/providers";

export interface DiscoveredRawModel {
  id?: string;
  raw: Record<string, unknown>;
}

/**
 * Builds provider-specific discovery HTTP headers with custom user headers applied last so overrides win.
 *
 * @param providerType - Provider type identifier from the catalog
 * @param apiKey - Decrypted API key, or null/empty for keyless providers
 * @param customHeaders - Optional user-defined header overrides
 * @returns Normalized HTTP header dictionary
 */
export function buildDiscoveryHeaders(
  providerType: string | null | undefined,
  apiKey: string | null | undefined,
  customHeaders: Record<string, string> = {},
): Record<string, string> {
  if (!apiKey) {
    return { ...customHeaders };
  }

  const { discovery } = getProviderDefinition(providerType);

  switch (discovery.authStyle) {
    case "anthropic":
      return {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        ...customHeaders,
      };
    case "google":
      return {
        "x-goog-api-key": apiKey,
        ...customHeaders,
      };
    case "bearer":
      return {
        Authorization: `Bearer ${apiKey}`,
        ...customHeaders,
      };
  }
}

/**
 * Builds the model-listing endpoint URL for a provider by trimming trailing slashes and appending its models path.
 *
 * @param baseUrl - Configured provider base URL
 * @param providerType - Provider type identifier from the catalog
 * @returns Full model-listing endpoint URL
 */
export function buildModelsEndpointUrl(
  baseUrl: string,
  providerType: string | null | undefined,
): string {
  const { discovery } = getProviderDefinition(providerType);
  return `${baseUrl.replace(/\/$/, "")}${discovery.modelsPath}`;
}

/**
 * Extracts model IDs and raw metadata objects from a provider's model-listing response payload.
 * Normalizes Google `models/` prefixes while preserving Cohere and OpenAI identifiers.
 *
 * @param payload - Parsed JSON response from the provider endpoint
 * @param responseFormat - Expected payload shape (`"openai"` or `"models"`)
 * @returns Array of normalized model ID candidates with their raw metadata
 */
export function extractDiscoveredModelIds(
  payload: unknown,
  responseFormat: ProviderDiscoveryResponseFormat,
): DiscoveredRawModel[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  if (responseFormat === "models") {
    const list = Array.isArray(record.models) ? record.models : [];
    return list.map((entry) => {
      const raw =
        entry && typeof entry === "object"
          ? (entry as Record<string, unknown>)
          : {};
      const id =
        typeof raw.id === "string"
          ? raw.id
          : typeof raw.name === "string"
            ? raw.name.replace(/^models\//, "")
            : undefined;
      return { id, raw };
    });
  }

  const list = Array.isArray(record.data) ? record.data : [];
  return list.map((entry) => {
    const raw =
      entry && typeof entry === "object"
        ? (entry as Record<string, unknown>)
        : {};
    const id = typeof raw.id === "string" ? raw.id : undefined;
    return { id, raw };
  });
}
