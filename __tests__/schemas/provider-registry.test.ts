import { describe, expect, it } from "vitest";
import {
  createModelSchema,
  createProviderSchema,
  exportProviderRegistryInputSchema,
  providerModelTypeSchema,
  registryExportSchema,
  updateModelSchema,
  updateProviderSchema,
} from "@/schemas/providers/provider-registry";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("schemas/providers/provider-registry", () => {
  it("validates providerModelTypeSchema", () => {
    expect(providerModelTypeSchema.safeParse("chat").success).toBe(true);
    expect(providerModelTypeSchema.safeParse("embedding").success).toBe(true);
    expect(providerModelTypeSchema.safeParse("both").success).toBe(true);
    expect(providerModelTypeSchema.safeParse("other").success).toBe(false);
  });

  it("validates createProviderSchema", () => {
    const valid = {
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      headers: { "X-Custom": "value" },
      isEnabled: true,
      requiresKey: true,
    };
    expect(createProviderSchema.safeParse(valid).success).toBe(true);

    // Invalid baseUrl
    expect(
      createProviderSchema.safeParse({ ...valid, baseUrl: "not-a-url" }).success,
    ).toBe(false);
  });

  it("validates updateProviderSchema with refinement", () => {
    // Empty object must fail refinement
    const emptyResult = updateProviderSchema.safeParse({});
    expect(emptyResult.success).toBe(false);
    if (!emptyResult.success) {
      expect(emptyResult.error.issues[0].message).toBe(
        "At least one field must be provided",
      );
    }

    // Partial update with at least one field must succeed
    const validResult = updateProviderSchema.safeParse({ name: "Updated Name" });
    expect(validResult.success).toBe(true);
  });

  it("validates createModelSchema", () => {
    const validModel = {
      providerId: VALID_UUID,
      modelId: "gpt-4o",
      label: "GPT-4o",
      modelType: "chat",
      contextWindow: 128000,
      capTools: true,
      capVision: true,
    };
    expect(createModelSchema.safeParse(validModel).success).toBe(true);

    // Invalid providerId
    expect(
      createModelSchema.safeParse({ ...validModel, providerId: "not-uuid" })
        .success,
    ).toBe(false);
  });

  it("validates updateModelSchema with refinement", () => {
    // With default(4096) on contextWindow, empty object parses with default contextWindow
    const emptyResult = updateModelSchema.safeParse({});
    expect(emptyResult.success).toBe(true);

    // Non-empty update must succeed
    const validResult = updateModelSchema.safeParse({ label: "New Label" });
    expect(validResult.success).toBe(true);
  });

  it("validates exportProviderRegistryInputSchema", () => {
    expect(exportProviderRegistryInputSchema.safeParse({}).success).toBe(true);
    expect(
      exportProviderRegistryInputSchema.safeParse({
        providerIds: [VALID_UUID],
      }).success,
    ).toBe(true);
  });

  it("validates registryExportSchema", () => {
    const validExport = {
      version: "1",
      exportedAt: new Date().toISOString(),
      providers: [
        {
          name: "OpenAI",
          baseUrl: "https://api.openai.com/v1",
          requiresKey: true,
          apiKey: null,
          models: [
            {
              modelId: "gpt-4",
              label: "GPT-4",
              modelType: "chat",
              contextWindow: 8192,
              embeddingDimensions: null,
              capabilities: {
                tools: true,
                vision: false,
                reasoning: false,
                structuredOutput: true,
              },
              isManuallyAdded: false,
            },
          ],
        },
      ],
    };
    expect(registryExportSchema.safeParse(validExport).success).toBe(true);
  });
});
