import { describe, expect, it } from "vitest";
import {
  buildLegacySeedModels,
  createSeedPlan,
  type LegacyUserSettingsRow,
  type SeedModelCandidate,
} from "@/lib/provider-registry/legacy-seed";

function makeSettings(
  overrides: Partial<LegacyUserSettingsRow> = {},
): LegacyUserSettingsRow {
  return {
    id: "settings-id",
    userId: "user-id",
    openrouterKey: "encrypted-key",
    defaultChatModelId: null,
    defaultEmbeddingModelId: null,
    ...overrides,
  };
}

describe("legacy provider seed helpers", () => {
  it("includes static chat seeds plus embedding fallback", () => {
    const candidates = buildLegacySeedModels();

    expect(candidates.length).toBeGreaterThanOrEqual(5);
    expect(
      candidates.some(
        (candidate) => candidate.modelId === "openai/gpt-oss-120b:free",
      ),
    ).toBe(true);
    expect(
      candidates.some(
        (candidate) =>
          candidate.modelId === "nvidia/llama-nemotron-embed-vl-1b-v2:free",
      ),
    ).toBe(true);
  });

  it("prefers existing defaults when present", () => {
    const candidates = buildLegacySeedModels();

    const plan = createSeedPlan(
      makeSettings({
        defaultChatModelId: "chat-existing",
        defaultEmbeddingModelId: "embedding-existing",
      }),
      candidates,
    );

    expect(plan.defaultChatModelKey).toBe("chat-existing");
    expect(plan.defaultEmbeddingModelKey).toBe("embedding-existing");
  });

  it("uses preferred GPT OSS and embedding fallback when defaults are missing", () => {
    const candidates = buildLegacySeedModels();

    const plan = createSeedPlan(makeSettings(), candidates);

    expect(plan.defaultChatModelKey).toBe("openai/gpt-oss-120b:free");
    expect(plan.defaultEmbeddingModelKey).toBe(
      "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    );
  });

  it("falls back to first available candidate when GPT OSS is unavailable", () => {
    const candidates: SeedModelCandidate[] = [
      {
        modelId: "custom/chat-model",
        label: "Custom",
        contextWindow: 4096,
        capTools: false,
        capVision: false,
        capReasoning: false,
        capStructuredOutput: false,
      },
      {
        modelId: "nvidia/llama-nemotron-embed-vl-1b-v2:free",
        label: "Embed",
        contextWindow: 8192,
        capTools: false,
        capVision: false,
        capReasoning: false,
        capStructuredOutput: false,
      },
    ];

    const plan = createSeedPlan(makeSettings(), candidates);

    expect(plan.defaultChatModelKey).toBe("custom/chat-model");
    expect(plan.defaultEmbeddingModelKey).toBe(
      "nvidia/llama-nemotron-embed-vl-1b-v2:free",
    );
  });
});
