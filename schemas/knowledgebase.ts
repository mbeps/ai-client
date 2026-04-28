import { z } from "zod";
import { nameField, descriptionField } from "./shared-fields";

/**
 * Validates knowledgebase rename operations with only the new name field.
 * Requires name to be non-empty and under 100 characters.
 * Use with renameKnowledgebase server action for quick name changes.
 *
 * @author Maruf Bepary
 */
export const renameKnowledgebaseSchema = z.object({
  name: nameField,
});

/**
 * Validates new knowledgebase creation with name and optional description.
 * Name required (1-100 chars); description optional (max 500 chars).
 * Use with createKnowledgebase server action to create new information repositories.
 *
 * @author Maruf Bepary
 */
export const createKnowledgebaseSchema = z.object({
  name: nameField,
  description: descriptionField,
});
