import { z } from "zod";

/**
 * Validates a translation request.
 * Ensures all required fields are present and within reasonable limits.
 *
 * @author Maruf Bepary
 */
export const translateRequestSchema = z
  .object({
    text: z.string().max(5000).optional(),
    sourceLanguage: z.string().min(1).max(50),
    targetLanguage: z.string().min(1).max(50),
    modelId: z.string().min(1).max(100).optional(),
    attachment: z
      .object({
        name: z.string(),
        type: z.enum(["image", "document"]),
        mimeType: z.string(),
        dataUrl: z.string().optional(),
        extractedText: z.string().optional(),
      })
      .optional(),
  })
  .refine((data) => data.text || data.attachment, {
    message: "Either text or an attachment must be provided",
  });

export type TranslateRequest = z.infer<typeof translateRequestSchema>;
