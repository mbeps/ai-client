import { z } from "zod";

/**
 * Validates memory creation payload.
 */
export const createMemorySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Memory content cannot be empty")
    .max(2000, "Memory must be at most 2000 characters"),
});

/**
 * Validates memory update payload.
 */
export const updateMemorySchema = z.object({
  id: z.string().uuid("Invalid memory ID"),
  content: z
    .string()
    .trim()
    .min(1, "Memory content cannot be empty")
    .max(2000, "Memory must be at most 2000 characters"),
});

/**
 * Validates memory deletion payload for one or multiple memory IDs.
 */
export const deleteMemoriesSchema = z.object({
  ids: z
    .array(z.string().uuid("Invalid memory ID"))
    .min(1, "At least one memory ID is required"),
});

/**
 * Validates internal tool input schema for save_memory tool called by AI models.
 */
export const saveMemoryToolSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Memory content cannot be empty")
    .max(2000, "Memory must be at most 2000 characters")
    .describe(
      "The concise fact, user preference, or enduring detail to remember across conversations.",
    ),
});

export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
export type DeleteMemoriesInput = z.infer<typeof deleteMemoriesSchema>;
export type SaveMemoryToolInput = z.infer<typeof saveMemoryToolSchema>;
