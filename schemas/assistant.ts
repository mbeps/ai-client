import { z } from "zod";
import { nameField, descriptionField } from "./shared-fields";

export const createAssistantSchema = z.object({
  name: nameField,
  description: descriptionField,
  prompt: z.string().max(10000).optional(),
  avatar: z.string().url().max(1024).optional().nullable(),
});

export const updateAssistantSchema = z.object({
  name: nameField.optional(),
  description: descriptionField,
  prompt: z.string().max(10000).optional(),
  avatar: z.string().url().max(1024).optional().nullable(),
});

export const renameAssistantSchema = z.object({
  name: nameField,
});
