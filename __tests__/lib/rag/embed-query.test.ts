import { describe, expect, it, vi } from "vitest";
import { embedQuery } from "@/lib/rag/embed-query";

const embedMock = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ embed: embedMock }));

const resolveEmbeddingProviderMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/chat/resolve-embedding-provider", () => ({
  resolveEmbeddingProvider: resolveEmbeddingProviderMock,
}));

describe("embedQuery", () => {
  it("embeds query with query: prefix for prefixed models", async () => {
    resolveEmbeddingProviderMock.mockResolvedValue({
      sdkProvider: { embeddingModel: vi.fn().mockReturnValue("model-inst") },
      modelId: "cohere/embed-english-v3.0",
    });
    embedMock.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });

    // Mock prefixed models set or module
    const { PREFIXED_EMBEDDING_MODELS } = await import("@/lib/rag/prefixed-embedding-models");
    PREFIXED_EMBEDDING_MODELS.add("cohere/embed-english-v3.0");

    const result = await embedQuery("test query", "user-1");
    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(embedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "query: test query",
      }),
    );
  });

  it("embeds query without prefix for standard models", async () => {
    resolveEmbeddingProviderMock.mockResolvedValue({
      sdkProvider: { embeddingModel: vi.fn().mockReturnValue("model-inst") },
      modelId: "openai/text-embedding-3-small",
    });
    embedMock.mockResolvedValue({ embedding: [0.4, 0.5] });

    const result = await embedQuery("test query", "user-1");
    expect(result).toEqual([0.4, 0.5]);
    expect(embedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "test query",
      }),
    );
  });
});
