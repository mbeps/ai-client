import { describe, expect, it } from "vitest";

import {
  getProviderDefinition,
  isProviderType,
  PROVIDER_CATALOG,
  PROVIDER_TYPES,
  type ProviderType,
} from "@/config/providers";

describe("PROVIDER_TYPES & PROVIDER_CATALOG", () => {
  it("defines all 22 expected provider types with unique IDs", () => {
    expect(PROVIDER_TYPES).toHaveLength(22);
    expect(PROVIDER_CATALOG).toHaveLength(22);

    const catalogIds = PROVIDER_CATALOG.map((p) => p.id);
    expect(new Set(catalogIds).size).toBe(22);
    expect(catalogIds).toEqual([...PROVIDER_TYPES]);
  });

  it("includes default, 19 official, and 2 community beta providers", () => {
    const defaultProviders = PROVIDER_CATALOG.filter((p) => p.tier === "default");
    const officialProviders = PROVIDER_CATALOG.filter((p) => p.tier === "official");
    const communityProviders = PROVIDER_CATALOG.filter((p) => p.tier === "community");

    expect(defaultProviders.map((p) => p.id)).toEqual(["openai-compatible"]);
    expect(officialProviders).toHaveLength(19);
    expect(communityProviders.map((p) => p.id)).toEqual(["openrouter", "llama-cpp"]);
  });

  it("sets isBeta to true only for community tier providers", () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.isBeta).toBe(provider.tier === "community");
    }
  });

  it("configures defaultRequiresKey as false only for llama-cpp", () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.defaultRequiresKey).toBe(provider.id !== "llama-cpp");
    }
  });

  it("configures supportsChat as false only for voyage", () => {
    for (const provider of PROVIDER_CATALOG) {
      expect(provider.supportsChat).toBe(provider.id !== "voyage");
    }
  });

  it("configures supportsEmbeddings accurately for all providers", () => {
    const embeddingProviders = new Set<ProviderType>([
      "openai-compatible",
      "llama-cpp",
      "ai-gateway",
      "openai",
      "google",
      "mistral",
      "togetherai",
      "cohere",
      "fireworks",
      "voyage",
      "deepinfra",
      "alibaba",
      "baseten",
    ]);

    for (const provider of PROVIDER_CATALOG) {
      expect(provider.supportsEmbeddings).toBe(embeddingProviders.has(provider.id));
    }
  });

  it("configures discovery metadata accurately", () => {
    const noSyncProviders = new Set<ProviderType>([
      "perplexity",
      "voyage",
      "minimax",
      "baseten",
    ]);

    for (const provider of PROVIDER_CATALOG) {
      expect(provider.discovery.supportsSync).toBe(!noSyncProviders.has(provider.id));
      expect(provider.discovery.modelsPath).toBe("/models");
    }

    expect(getProviderDefinition("anthropic").discovery.authStyle).toBe("anthropic");
    expect(getProviderDefinition("google").discovery.authStyle).toBe("google");
    expect(getProviderDefinition("google").discovery.responseFormat).toBe("models");
    expect(getProviderDefinition("cohere").discovery.responseFormat).toBe("models");
    expect(getProviderDefinition("openai").discovery.responseFormat).toBe("openai");

    expect(getProviderDefinition("openai-compatible").discovery.probeEmbeddingsEndpoint).toBe(
      true
    );
    expect(getProviderDefinition("llama-cpp").discovery.probeEmbeddingsEndpoint).toBe(true);
    expect(getProviderDefinition("openai").discovery.probeEmbeddingsEndpoint).toBeUndefined();
  });
});

describe("getProviderDefinition", () => {
  it("returns the matching definition for every valid provider type", () => {
    for (const type of PROVIDER_TYPES) {
      const def = getProviderDefinition(type);
      expect(def.id).toBe(type);
    }
  });

  it("falls back to openai-compatible for null, undefined, or unknown values", () => {
    expect(getProviderDefinition(null).id).toBe("openai-compatible");
    expect(getProviderDefinition(undefined).id).toBe("openai-compatible");
    expect(getProviderDefinition("").id).toBe("openai-compatible");
    expect(getProviderDefinition("unknown-provider").id).toBe("openai-compatible");
  });
});

describe("isProviderType", () => {
  it("returns true for valid provider types and false otherwise", () => {
    expect(isProviderType("openai-compatible")).toBe(true);
    expect(isProviderType("anthropic")).toBe(true);
    expect(isProviderType("llama-cpp")).toBe(true);
    expect(isProviderType("invalid-type")).toBe(false);
    expect(isProviderType("")).toBe(false);
  });
});
