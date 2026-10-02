import { z } from "zod";

/**
 * Validates a translation request.
 * Ensures all required fields are present and within reasonable limits.
 *
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
  .refine(
    (data) => {
      if (data.text?.trim()) return true;
      if (data.attachment?.type === "image") return true;
      if (
        data.attachment?.type === "document" &&
        data.attachment.extractedText?.trim()
      ) {
        return true;
      }
      return false;
    },
    {
      message: "Either text or an attachment with content must be provided",
    },
  );
