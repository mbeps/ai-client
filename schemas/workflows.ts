import { z } from "zod";

/**
 * Validates a translation request.
 * Ensures all required fields are present and within reasonable limits.
 *
 * @author Maruf Bepary
 */
export const translateRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  sourceLanguage: z.string().min(1).max(50),
  targetLanguage: z.string().min(1).max(50),
  modelId: z.string().min(1).max(100).optional(),
});

export type TranslateRequest = z.infer<typeof translateRequestSchema>;
