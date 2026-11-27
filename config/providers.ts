/**
 * Central catalog of supported AI SDK providers and their discovery/capability metadata.
 * Single source of truth for provider forms, Zod schemas, discovery, and SDK instantiation.
 */

export const PROVIDER_TYPES = [
  "openai-compatible",
  "ai-gateway",
  "xai",
  "openai",
  "anthropic",
  "groq",
  "deepinfra",
  "google",
  "mistral",
  "togetherai",
  "cohere",
  "fireworks",
  "voyage",
  "deepseek",
  "moonshotai",
  "alibaba",
  "minimax",
  "cerebras",
  "perplexity",
  "baseten",
  "openrouter",
  "llama-cpp",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

export type ProviderTier = "default" | "official" | "community";

export type ProviderDiscoveryAuthStyle = "bearer" | "anthropic" | "google";

export type ProviderDiscoveryResponseFormat = "openai" | "models";

export interface ProviderDiscoveryConfig {
  supportsSync: boolean;
  authStyle: ProviderDiscoveryAuthStyle;
  modelsPath: string;
  responseFormat: ProviderDiscoveryResponseFormat;
  probeEmbeddingsEndpoint?: boolean;
}

export interface ProviderDefinition {
  id: ProviderType;
  label: string;
  tier: ProviderTier;
  isBeta: boolean;
  defaultBaseUrl: string;
  defaultRequiresKey: boolean;
  supportsChat: boolean;
  supportsEmbeddings: boolean;
  discovery: ProviderDiscoveryConfig;
}

const DEFAULT_DISCOVERY: ProviderDiscoveryConfig = {
  supportsSync: true,
  authStyle: "bearer",
  modelsPath: "/models",
  responseFormat: "openai",
};

export const PROVIDER_CATALOG: readonly ProviderDefinition[] = [
  {
    id: "openai-compatible",
    label: "OpenAI Compatible",
    tier: "default",
    isBeta: false,
    defaultBaseUrl: "",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: { ...DEFAULT_DISCOVERY, probeEmbeddingsEndpoint: true },
  },
  {
    id: "ai-gateway",
    label: "Vercel AI Gateway",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://ai-gateway.vercel.sh/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.x.ai/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: false,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "openai",
    label: "OpenAI",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.anthropic.com/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: false,
    discovery: { ...DEFAULT_DISCOVERY, authStyle: "anthropic" },
  },
  {
    id: "groq",
    label: "Groq",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: false,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.deepinfra.com/v1/openai",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "google",
    label: "Google (Gemini)",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: {
      supportsSync: true,
      authStyle: "google",
      modelsPath: "/models",
      responseFormat: "models",
    },
  },
  {
    id: "mistral",
    label: "Mistral AI",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.mistral.ai/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "togetherai",
    label: "Together AI",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.together.xyz/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "cohere",
    label: "Cohere",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.cohere.com/v2",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: { ...DEFAULT_DISCOVERY, responseFormat: "models" },
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.fireworks.ai/inference/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "voyage",
    label: "Voyage AI",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.voyageai.com/v1",
    defaultRequiresKey: true,
    supportsChat: false,
    supportsEmbeddings: true,
    discovery: { ...DEFAULT_DISCOVERY, supportsSync: false },
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.deepseek.com/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: false,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "moonshotai",
    label: "Moonshot AI",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.moonshot.ai/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: false,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "alibaba",
    label: "Alibaba (Qwen)",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "minimax",
    label: "MiniMax",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.minimax.io/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: false,
    discovery: { ...DEFAULT_DISCOVERY, supportsSync: false },
  },
  {
    id: "cerebras",
    label: "Cerebras",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.cerebras.ai/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: false,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://api.perplexity.ai",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: false,
    discovery: { ...DEFAULT_DISCOVERY, supportsSync: false },
  },
  {
    id: "baseten",
    label: "Baseten",
    tier: "official",
    isBeta: false,
    defaultBaseUrl: "https://inference.baseten.co/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: { ...DEFAULT_DISCOVERY, supportsSync: false },
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    tier: "community",
    isBeta: true,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    defaultRequiresKey: true,
    supportsChat: true,
    supportsEmbeddings: false,
    discovery: DEFAULT_DISCOVERY,
  },
  {
    id: "llama-cpp",
    label: "llama.cpp",
    tier: "community",
    isBeta: true,
    defaultBaseUrl: "http://localhost:8080/v1",
    defaultRequiresKey: false,
    supportsChat: true,
    supportsEmbeddings: true,
    discovery: { ...DEFAULT_DISCOVERY, probeEmbeddingsEndpoint: true },
  },
] as const;

const PROVIDER_CATALOG_BY_ID = new Map<ProviderType, ProviderDefinition>(
  PROVIDER_CATALOG.map((def) => [def.id, def]),
);

const DEFAULT_PROVIDER_DEFINITION =
  PROVIDER_CATALOG_BY_ID.get("openai-compatible")!;

/**
 * Type guard checking whether a raw string is a known {@link ProviderType}.
 */
export function isProviderType(value: string): value is ProviderType {
  return PROVIDER_CATALOG_BY_ID.has(value as ProviderType);
}

/**
 * Returns the {@link ProviderDefinition} for a given provider type,
 * falling back to `"openai-compatible"` for null, undefined, or unknown values.
 */
export function getProviderDefinition(
  type: string | null | undefined,
): ProviderDefinition {
  if (!type) {
    return DEFAULT_PROVIDER_DEFINITION;
  }
  return (
    PROVIDER_CATALOG_BY_ID.get(type as ProviderType) ??
    DEFAULT_PROVIDER_DEFINITION
  );
}
