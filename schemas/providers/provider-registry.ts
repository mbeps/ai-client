import { z } from "zod";
import { nameField, idField } from "../shared-fields";

export const providerModelTypeSchema = z.enum(["chat", "embedding", "both"]);

const providerHeadersSchema = z.record(z.string(), z.string());

export const createProviderSchema = z.object({
  name: nameField,
  baseUrl: z.string().url("Invalid provider URL").max(1024),
  apiKey: z.string().max(4096).optional().nullable(),
  headers: providerHeadersSchema.optional(),
  isEnabled: z.boolean().optional(),
  requiresKey: z.boolean().optional(),
});

export const updateProviderSchema = createProviderSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

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

export const updateModelSchema = createModelSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

const registryCapabilitiesSchema = z.object({
  tools: z.boolean(),
  vision: z.boolean(),
  reasoning: z.boolean(),
  structuredOutput: z.boolean(),
});

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

const registryProviderSchema = z.object({
  name: z.string().min(1).max(100),
  baseUrl: z.string().url().max(1024),
  requiresKey: z.boolean(),
  apiKey: z.string().nullable().optional(),
  headers: providerHeadersSchema.optional().default({}),
  isEnabled: z.boolean().optional(),
  models: z.array(registryModelSchema).max(500),
});

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
export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type CreateModelInput = z.infer<typeof createModelSchema>;
export type UpdateModelInput = z.infer<typeof updateModelSchema>;
export type RegistryExport = z.infer<typeof registryExportSchema>;
export type ExportProviderRegistryInput = z.infer<
  typeof exportProviderRegistryInputSchema
>;
export type ImportProviderRegistryInput = z.infer<
  typeof importProviderRegistryInputSchema
>;
