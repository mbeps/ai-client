import { z } from "zod";
import { nameField, idField } from "../shared-fields";

/**
 * Enumeration of AI model types available from providers.
 * - "chat": Large Language Models (LLMs) for conversational AI
 * - "embedding": Embedding models for semantic search and RAG
 * - "both": Models supporting both chat and embedding capabilities
 *
 * @author Maruf Bepary
 */
export const providerModelTypeSchema = z.enum(["chat", "embedding", "both"]);

const providerHeadersSchema = z.record(z.string(), z.string());

/**
 * Validates creation of a new OpenAI-compatible AI provider.
 * Name required; baseUrl must be valid URL (e.g., https://api.openai.com).
 * apiKey optional (some providers allow key-free usage); headers for custom authentication.
 * isEnabled controls visibility and availability for model selection.
 * requiresKey flag indicates whether this provider mandates API key configuration.
 *
 * @author Maruf Bepary
 */
export const createProviderSchema = z.object({
  name: nameField,
  baseUrl: z.string().url("Invalid provider URL").max(1024),
  apiKey: z.string().max(4096).optional().nullable(),
  headers: providerHeadersSchema.optional(),
  isEnabled: z.boolean().optional(),
  requiresKey: z.boolean().optional(),
});

/**
 * Validates updates to an existing provider configuration.
 * All fields optional to enable selective updates of name, URL, API key, or headers.
 * At least one field must be provided to prevent no-op updates.
 *
 * @author Maruf Bepary
 */
export const updateProviderSchema = createProviderSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * Validates registration of a single AI model from a provider.
 * providerId links model to the provider account.
 * modelId is the provider's internal model identifier (e.g., "gpt-4", "claude-opus").
 * Label is the user-facing display name.
 * modelType specifies whether model is for chat, embedding, or both.
 * contextWindow specifies token limit (e.g., 4096, 128000).
 * embeddingDimensions applies only to embedding models (e.g., 1536 for OpenAI).
 * Capability flags (tools, vision, reasoning, structuredOutput) indicate advanced features.
 * isEnabled controls availability for use in chats.
 *
 * @author Maruf Bepary
 */
export const createModelSchema = z.object({
  providerId: idField,
  modelId: z.string().min(1).max(255),
  label: z.string().min(1).max(255),
  modelType: providerModelTypeSchema,
  contextWindow: z.number().int().positive().max(10_000_000).default(4096),
  embeddingDimensions: z
    .number()
    .int()
    .positive()
    .max(100_000)
    .nullable()
    .optional(),
  capTools: z.boolean().optional(),
  capVision: z.boolean().optional(),
  capReasoning: z.boolean().optional(),
  capStructuredOutput: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
});

/**
 * Validates updates to an existing model configuration.
 * All fields optional to enable selective updates.
 * At least one field must be provided to prevent no-op updates.
 *
 * @author Maruf Bepary
 */
export const updateModelSchema = createModelSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * Capability metadata for a registered model.
 * Boolean flags indicate supported features (tools, vision, reasoning, structured output).
 *
 * @author Maruf Bepary
 */
const registryCapabilitiesSchema = z.object({
  tools: z.boolean(),
  vision: z.boolean(),
  reasoning: z.boolean(),
  structuredOutput: z.boolean(),
});

/**
 * Represents a model in the provider registry export/import format.
 * Includes full model metadata for serialization and transport.
 * isManuallyAdded flag indicates whether model was auto-discovered or manually added.
 *
 * @author Maruf Bepary
 */
const registryModelSchema = z.object({
  modelId: z.string().min(1).max(255),
  label: z.string().min(1).max(255),
  modelType: providerModelTypeSchema,
  contextWindow: z.number().int().positive().max(10_000_000),
  embeddingDimensions: z.number().int().positive().max(100_000).nullable(),
  capabilities: registryCapabilitiesSchema,
  isManuallyAdded: z.boolean(),
  isEnabled: z.boolean().optional(),
});

/**
 * Represents a provider in the registry export/import format.
 * Includes all provider metadata and associated models for serialization.
 * Models array capped at 500 per provider for practical limits.
 *
 * @author Maruf Bepary
 */
const registryProviderSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url().max(1024),
  requiresKey: z.boolean(),
  apiKey: z.string().nullable().optional(),
  headers: providerHeadersSchema.optional().default({}),
  isEnabled: z.boolean().optional(),
  models: z.array(registryModelSchema).max(500),
});

/**
 * Validates the complete provider registry export format.
 * Includes version for future compatibility and export timestamp.
 * Providers array capped at 100 for practical limits.
 * Use for exporting and importing the entire provider and model registry.
 *
 * @author Maruf Bepary
 */
export const registryExportSchema = z.object({
  version: z.literal("1"),
  exportedAt: z.string().datetime(),
  providers: z.array(registryProviderSchema).max(100),
});

export const exportProviderRegistryInputSchema = z.object({
  providerIds: z.array(idField).max(100).optional(),
});

export const importProviderRegistryInputSchema = registryExportSchema;

export type ProviderModelType = z.infer<typeof providerModelTypeSchema>;

/**
 * Validates input for importing a provider registry.
 * Must conform to the registryExportSchema format.
 * Allows bulk import of providers and models.
 *
 * @author Maruf Bepary
 */
export type CreateProviderInput = z.infer<typeof createProviderSchema>;

/**
 * TypeScript type for update provider input.
 *
 * @author Maruf Bepary
 */
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;

/**
 * TypeScript type for create model input.
 *
 * @author Maruf Bepary
 */
export type CreateModelInput = z.infer<typeof createModelSchema>;

/**
 * TypeScript type for update model input.
 *
 * @author Maruf Bepary
 */
export type UpdateModelInput = z.infer<typeof updateModelSchema>;

/**
 * TypeScript type for complete registry export.
 *
 * @author Maruf Bepary
 */
export type RegistryExport = z.infer<typeof registryExportSchema>;

/**
 * TypeScript type for export provider registry input.
 *
 * @author Maruf Bepary
 */
export type ExportProviderRegistryInput = z.infer<
  typeof exportProviderRegistryInputSchema
>;

/**
 * TypeScript type for import provider registry input.
 *
 * @author Maruf Bepary
 */
export type ImportProviderRegistryInput = z.infer<
  typeof importProviderRegistryInputSchema
>;
