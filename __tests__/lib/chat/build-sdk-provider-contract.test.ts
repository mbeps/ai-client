import { afterEach, describe, expect, it, vi } from "vitest";
import { PROVIDER_CATALOG } from "@/config/providers";
import { buildSdkProvider } from "@/lib/chat/build-sdk-provider";

const CAPTURED_FETCH_ERROR = "CAPTURED_FETCH_CALL";

function createCapturingFetch() {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];

  const mockFetch: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const headers: Record<string, string> = {};

    if (init?.headers) {
      const h = new Headers(init.headers);
      h.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    } else if (input instanceof Request) {
      input.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
    }

    calls.push({ url, headers });
    throw new Error(CAPTURED_FETCH_ERROR);
  };

  return { calls, mockFetch };
}

describe("buildSdkProvider real-SDK contract", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("executes keyless llama-cpp with OPENAI_API_KEY unset and does not leak server OPENAI_API_KEY", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const unsetCapture = createCapturingFetch();
    const unsetProvider = buildSdkProvider({
      providerType: "llama-cpp",
      providerName: "Local llama.cpp",
      baseUrl: "http://localhost:8080/v1",
      apiKey: null,
      requiresKey: false,
      headers: {},
      fetch: unsetCapture.mockFetch,
    });

    await expect(
      unsetProvider.chat("llama-3.2").doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      }),
    ).rejects.toThrow(CAPTURED_FETCH_ERROR);

    expect(unsetCapture.calls).toHaveLength(1);
    expect(unsetCapture.calls[0]?.url).toBe("http://localhost:8080/v1/chat/completions");
    expect(unsetCapture.calls[0]?.headers.authorization).toBe("Bearer not-required");

    vi.stubEnv("OPENAI_API_KEY", "sk-server-secret-should-not-leak");
    const leakCapture = createCapturingFetch();
    const leakProvider = buildSdkProvider({
      providerType: "llama-cpp",
      providerName: "Local llama.cpp",
      baseUrl: "http://localhost:8080/v1",
      apiKey: null,
      requiresKey: false,
      headers: {},
      fetch: leakCapture.mockFetch,
    });

    await expect(
      leakProvider.chat("llama-3.2").doGenerate({
        prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      }),
    ).rejects.toThrow(CAPTURED_FETCH_ERROR);

    expect(leakCapture.calls[0]?.headers.authorization).toBe("Bearer not-required");
  });

  it.each(
    PROVIDER_CATALOG.filter(
      (def) => def.id !== "openai-compatible" && def.id !== "llama-cpp",
    ).map((def) => [def.id, def] as const),
  )(
    "catalog defaultBaseUrl for %s matches real SDK default request path",
    async (providerType, def) => {
      const sdkDefaultCapture = createCapturingFetch();
      const catalogCapture = createCapturingFetch();

      const sdkDefaultProvider = buildSdkProvider({
        providerType,
        providerName: def.label,
        baseUrl: "",
        apiKey: "sk-contract-test",
        headers: {},
        fetch: sdkDefaultCapture.mockFetch,
      });

      const catalogProvider = buildSdkProvider({
        providerType,
        providerName: def.label,
        baseUrl: def.defaultBaseUrl,
        apiKey: "sk-contract-test",
        headers: {},
        fetch: catalogCapture.mockFetch,
      });

      if (def.supportsChat) {
        const prompt = [{ role: "user" as const, content: [{ type: "text" as const, text: "hi" }] }];
        await expect(sdkDefaultProvider.chat("test-model").doGenerate({ prompt })).rejects.toThrow(
          CAPTURED_FETCH_ERROR,
        );
        await expect(catalogProvider.chat("test-model").doGenerate({ prompt })).rejects.toThrow(
          CAPTURED_FETCH_ERROR,
        );
      } else {
        await expect(
          sdkDefaultProvider.embeddingModel("test-embed").doEmbed({ values: ["hi"] }),
        ).rejects.toThrow(CAPTURED_FETCH_ERROR);
        await expect(
          catalogProvider.embeddingModel("test-embed").doEmbed({ values: ["hi"] }),
        ).rejects.toThrow(CAPTURED_FETCH_ERROR);
      }

      expect(sdkDefaultCapture.calls).toHaveLength(1);
      expect(catalogCapture.calls).toHaveLength(1);
      expect(catalogCapture.calls[0]?.url).toBe(sdkDefaultCapture.calls[0]?.url);
    },
  );

  it("constructs a real EmbeddingModel without throwing for every provider with supportsEmbeddings=true", () => {
    const embeddingProviders = PROVIDER_CATALOG.filter((def) => def.supportsEmbeddings);
    expect(embeddingProviders.length).toBeGreaterThan(0);

    for (const def of embeddingProviders) {
      const provider = buildSdkProvider({
        providerType: def.id,
        providerName: def.label,
        baseUrl: def.defaultBaseUrl || "https://example.com/v1",
        apiKey: "sk-contract-test",
        requiresKey: def.defaultRequiresKey,
        headers: {},
      });

      const model = provider.embeddingModel("test-embed");
      expect(model).toBeTruthy();
    }
  });
});
