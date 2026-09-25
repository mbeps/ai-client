vi.mock("@/config/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    ENCRYPTION_SECRET:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    NODE_ENV: "test",
  },
}));

const selectWhereMock = vi.hoisted(() => vi.fn());
const updateReturningMock = vi.hoisted(() => vi.fn());
const insertReturningMock = vi.hoisted(() => vi.fn());
const insertValuesMock = vi.hoisted(() => vi.fn());

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: selectWhereMock,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: updateReturningMock,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((...args: any[]) => {
        insertValuesMock(...args);
        return {
          returning: insertReturningMock,
          then: (resolve: (v: any) => void) => resolve(insertReturningMock()),
        };
      }),
    })),
  },
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
    session: { id: "session-1" },
  }),
}));

vi.mock("@/lib/encryption/encrypt", () => ({
  encrypt: vi.fn().mockImplementation((val: string) => `enc-${val}`),
}));

vi.mock("@/lib/logger", () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}));

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelDuplicateImportError } from "@/lib/errors";
import { importProviderRegistry } from "@/actions/providers/import-registry";

describe("importProviderRegistry action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectWhereMock.mockResolvedValue([]);
    updateReturningMock.mockResolvedValue([
      { id: "prov-1", apiKey: "existing-enc-key" },
    ]);
    insertReturningMock.mockResolvedValue([{ id: "prov-new-1" }]);
  });

  it("rejects malformed registry payloads", async () => {
    await expect(importProviderRegistry({} as any)).rejects.toThrow();
  });

  it("imports new providers and models when none exist", async () => {
    // 1st select: provider check -> not found
    selectWhereMock.mockResolvedValueOnce([]);
    // insert provider returning
    insertReturningMock.mockResolvedValueOnce([{ id: "prov-new-1" }]);
    // 2nd select: model-1 check -> not found
    selectWhereMock.mockResolvedValueOnce([]);
    // 3rd select: model-2 check -> not found
    selectWhereMock.mockResolvedValueOnce([]);

    const payload = {
      version: "1" as const,
      exportedAt: new Date().toISOString(),
      providers: [
        {
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          requiresKey: true,
          apiKey: "sk-test-123",
          headers: { "X-Custom": "val" },
          isEnabled: true,
          models: [
            {
              modelId: "gpt-4o",
              label: "GPT-4o",
              modelType: "chat" as const,
              contextWindow: 128000,
              embeddingDimensions: null,
              capabilities: {
                tools: true,
                vision: true,
                reasoning: false,
                structuredOutput: true,
              },
              isManuallyAdded: false,
              isEnabled: true,
            },
            {
              modelId: "text-embedding-3-small",
              label: "Embedding Small",
              modelType: "embedding" as const,
              contextWindow: 8191,
              embeddingDimensions: 1536,
              capabilities: {
                tools: false,
                vision: false,
                reasoning: false,
                structuredOutput: false,
              },
              isManuallyAdded: true,
            },
          ],
        },
      ],
    };

    const result = await importProviderRegistry(payload);

    expect(result).toEqual({
      providersCreated: 1,
      providersUpdated: 0,
      modelsCreated: 2,
      modelsSkipped: 0,
    });
    expect(insertValuesMock).toHaveBeenCalled();
  });

  it("updates existing provider and creates new models", async () => {
    // 1st select: provider check -> found existing provider
    selectWhereMock.mockResolvedValueOnce([
      { id: "prov-exist-1", apiKey: "old-key", name: "Anthropic" },
    ]);
    // update provider returning
    updateReturningMock.mockResolvedValueOnce([{ id: "prov-exist-1" }]);
    // 2nd select: model check -> not found
    selectWhereMock.mockResolvedValueOnce([]);

    const payload = {
      version: "1" as const,
      exportedAt: new Date().toISOString(),
      providers: [
        {
          name: "Anthropic",
          baseUrl: "https://api.anthropic.com/v1",
          requiresKey: true,
          apiKey: "sk-ant-new",
          isEnabled: true,
          models: [
            {
              modelId: "claude-3-5-sonnet",
              label: "Claude 3.5 Sonnet",
              modelType: "chat" as const,
              contextWindow: 200000,
              embeddingDimensions: null,
              capabilities: {
                tools: true,
                vision: true,
                reasoning: true,
                structuredOutput: true,
              },
              isManuallyAdded: false,
            },
          ],
        },
      ],
    };

    const result = await importProviderRegistry(payload);

    expect(result).toEqual({
      providersCreated: 0,
      providersUpdated: 1,
      modelsCreated: 1,
      modelsSkipped: 0,
    });
  });

  it("updates existing provider when apiKey is null, preserving existing apiKey", async () => {
    // 1st select: provider check -> found
    selectWhereMock.mockResolvedValueOnce([
      { id: "prov-exist-2", apiKey: "preserve-key", name: "Ollama" },
    ]);
    // update provider returning
    updateReturningMock.mockResolvedValueOnce([{ id: "prov-exist-2" }]);
    // 2nd select: model check -> not found
    selectWhereMock.mockResolvedValueOnce([]);

    const payload = {
      version: "1" as const,
      exportedAt: new Date().toISOString(),
      providers: [
        {
          name: "Ollama",
          baseUrl: "http://localhost:11434/v1",
          requiresKey: false,
          apiKey: null,
          models: [
            {
              modelId: "llama3",
              label: "Llama 3",
              modelType: "chat" as const,
              contextWindow: 8192,
              embeddingDimensions: null,
              capabilities: {
                tools: false,
                vision: false,
                reasoning: false,
                structuredOutput: false,
              },
              isManuallyAdded: false,
            },
          ],
        },
      ],
    };

    const result = await importProviderRegistry(payload);

    expect(result).toEqual({
      providersCreated: 0,
      providersUpdated: 1,
      modelsCreated: 1,
      modelsSkipped: 0,
    });
  });

  it("updates existing provider with isEnabled explicitly false and model with isEnabled false", async () => {
    // 1st select: provider check -> found
    selectWhereMock.mockResolvedValueOnce([
      { id: "prov-exist-3", apiKey: "exist-key", name: "Custom" },
    ]);
    // update provider returning
    updateReturningMock.mockResolvedValueOnce([{ id: "prov-exist-3" }]);
    // 2nd select: model check -> not found
    selectWhereMock.mockResolvedValueOnce([]);

    const payload = {
      version: "1" as const,
      exportedAt: new Date().toISOString(),
      providers: [
        {
          name: "Custom",
          baseUrl: "https://api.custom.com/v1",
          requiresKey: true,
          apiKey: "new-key",
          isEnabled: false,
          models: [
            {
              modelId: "model-disabled",
              label: "Disabled Model",
              modelType: "chat" as const,
              contextWindow: 4096,
              embeddingDimensions: null,
              capabilities: {
                tools: false,
                vision: false,
                reasoning: false,
                structuredOutput: false,
              },
              isManuallyAdded: false,
              isEnabled: false,
            },
          ],
        },
      ],
    };

    const result = await importProviderRegistry(payload);

    expect(result).toEqual({
      providersCreated: 0,
      providersUpdated: 1,
      modelsCreated: 1,
      modelsSkipped: 0,
    });
  });

  it("creates a new provider with isEnabled explicitly false and custom headers", async () => {
    // 1st select: provider check -> not found
    selectWhereMock.mockResolvedValueOnce([]);
    // insert provider returning
    insertReturningMock.mockResolvedValueOnce([
      { id: "prov-disabled", name: "DisabledProvider" },
    ]);
    // 2nd select: model check -> not found
    selectWhereMock.mockResolvedValueOnce([]);

    const payload = {
      version: "1" as const,
      exportedAt: new Date().toISOString(),
      providers: [
        {
          name: "DisabledProvider",
          baseUrl: "https://api.disabled.com/v1",
          requiresKey: true,
          apiKey: "sk-disabled",
          isEnabled: false,
          headers: { "X-Custom-Header": "header-val" },
          models: [
            {
              modelId: "disabled-model",
              label: "Disabled Model",
              modelType: "chat" as const,
              contextWindow: 4096,
              embeddingDimensions: null,
              capabilities: {
                tools: false,
                vision: false,
                reasoning: false,
                structuredOutput: false,
              },
              isManuallyAdded: false,
              isEnabled: false,
            },
          ],
        },
      ],
    };

    const result = await importProviderRegistry(payload);

    expect(result).toEqual({
      providersCreated: 1,
      providersUpdated: 0,
      modelsCreated: 1,
      modelsSkipped: 0,
    });
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        isEnabled: false,
        headers: expect.stringContaining("header-val"),
      }),
    );
  });

  it("updates an existing provider with isEnabled explicitly false", async () => {
    selectWhereMock.mockResolvedValueOnce([
      { id: "prov-exist-dis", apiKey: "old-key", name: "ExistingDis" },
    ]);
    updateReturningMock.mockResolvedValueOnce([{ id: "prov-exist-dis" }]);
    selectWhereMock.mockResolvedValueOnce([]);

    const payload = {
      version: "1" as const,
      exportedAt: new Date().toISOString(),
      providers: [
        {
          name: "ExistingDis",
          baseUrl: "https://api.existing.com/v1",
          requiresKey: false,
          apiKey: "sk-new",
          isEnabled: false,
          models: [
            {
              modelId: "m-1",
              label: "M 1",
              modelType: "chat" as const,
              contextWindow: 4096,
              embeddingDimensions: null,
              capabilities: {
                tools: false,
                vision: false,
                reasoning: false,
                structuredOutput: false,
              },
              isManuallyAdded: false,
            },
          ],
        },
      ],
    };

    const result = await importProviderRegistry(payload);
    expect(result.providersUpdated).toBe(1);
  });

  it("throws ModelDuplicateImportError if duplicate models exist for a provider", async () => {
    // 1st select: provider check -> found
    selectWhereMock.mockResolvedValueOnce([
      { id: "prov-1", apiKey: "enc-key", name: "OpenAI" },
    ]);
    updateReturningMock.mockResolvedValueOnce([{ id: "prov-1" }]);
    // 2nd select: model-1 check -> found (duplicate)
    selectWhereMock.mockResolvedValueOnce([{ id: "model-1" }]);

    const payload = {
      version: "1" as const,
      exportedAt: new Date().toISOString(),
      providers: [
        {
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          requiresKey: true,
          apiKey: "sk-123",
          models: [
            {
              modelId: "gpt-4o",
              label: "GPT-4o",
              modelType: "chat" as const,
              contextWindow: 128000,
              embeddingDimensions: null,
              capabilities: {
                tools: true,
                vision: true,
                reasoning: false,
                structuredOutput: true,
              },
              isManuallyAdded: false,
            },
          ],
        },
      ],
    };

    await expect(importProviderRegistry(payload)).rejects.toThrow(
      ModelDuplicateImportError,
    );
  });
});
