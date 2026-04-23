import { z } from "zod";

export const createPromptSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  content: z.string().min(1, "Content is required").max(10000),
  shortcut: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Shortcuts can only contain letters, numbers, dots, underscores, and hyphens"),
});

export const updatePromptSchema = createPromptSchema.partial();

export const renamePromptSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
});
