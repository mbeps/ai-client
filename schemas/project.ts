import { z } from "zod";
import { nameField, descriptionField } from "./shared-fields";

export const createProjectSchema = z.object({
  name: nameField,
  description: descriptionField,
  globalPrompt: z.string().max(10000).optional(),
});

export const updateProjectSchema = z.object({
  name: nameField.optional(),
  description: descriptionField,
  globalPrompt: z.string().max(10000).optional(),
});

export const renameProjectSchema = z.object({
  name: nameField,
});
