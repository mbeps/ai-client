import { beforeEach, describe, expect, it, vi } from "vitest";

const embedManyMock = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({ embedMany: embedManyMock }));
vi.mock("@/lib/chat/resolve-embedding-provider", () => ({
  resolveEmbeddingProvider: vi.fn().mockResolvedValue({
    sdkProvider: { embeddingModel: vi.fn() },
    modelId: "test-model",
  }),
}));
vi.mock("@/lib/rag/prefixed-embedding-models", () => ({
  PREFIXED_EMBEDDING_MODELS: new Set<string>(),
}));

import { embedDocuments } from "../../../lib/rag/embed-documents";

describe("embedDocuments batching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Each call returns one embedding per input value so we can verify order.
    embedManyMock.mockImplementation(async ({ values }) => ({
      embeddings: values.map((v: string) => [v.length]),
    }));
  });

  it("returns empty array without calling embedMany for empty input", async () => {
    const result = await embedDocuments([], "user-1");
    expect(result).toEqual([]);
    expect(embedManyMock).not.toHaveBeenCalled();
  });

  it("makes a single call when under the batch size", async () => {
    const texts = Array.from({ length: 10 }, (_, i) => `text-${i}`);
    await embedDocuments(texts, "user-1");
    expect(embedManyMock).toHaveBeenCalledTimes(1);
    expect(embedManyMock.mock.calls[0][0].values).toHaveLength(10);
  });

  it("splits 200 texts into batches of 96/96/8", async () => {
    const texts = Array.from({ length: 200 }, (_, i) => `text-${i}`);
    const result = await embedDocuments(texts, "user-1");

    expect(embedManyMock).toHaveBeenCalledTimes(3);
    const batchSizes = embedManyMock.mock.calls.map((c) => c[0].values.length);
    expect(batchSizes).toEqual([96, 96, 8]);
    expect(result).toHaveLength(200);
  });

  it("preserves embedding order across batches", async () => {
    const texts = Array.from({ length: 100 }, (_, i) => `text-${i}`);
    const result = await embedDocuments(texts, "user-1");

    // text length of "text-N" varies (6 or 7 chars), so reconstruct expected lengths
    expect(result[0]).toEqual([texts[0].length]);
    expect(result[96]).toEqual([texts[96].length]);
    expect(result[99]).toEqual([texts[99].length]);
  });
});
