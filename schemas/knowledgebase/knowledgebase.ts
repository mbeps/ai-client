import { z } from "zod";
import {
  nameField,
  descriptionField,
  idField,
  renameSchema,
} from "../shared-fields";

/**
 * Validates new knowledgebase creation with name and optional description.
 * Name required (1-100 chars); description optional (max 500 chars).
 * Use with createKnowledgebase server action to create new information repositories.
 */
export const createKnowledgebaseSchema = z.object({
  name: nameField,
  description: descriptionField,
});

/**
 * Validates knowledgebase rename operations with only the new name field.
 * Requires name to be non-empty and under 100 characters.
 * Use with renameKnowledgebase server action for quick name changes.
 */
export const renameKnowledgebaseSchema = renameSchema;

/**
 * Validates updates to an existing knowledgebase.
 * Includes optional name and description.
 * Use with updateKnowledgebase server action for consolidated metadata updates.
 */
export const updateKnowledgebaseSchema = createKnowledgebaseSchema.partial();

export const addDocumentSchema = z.object({
  kbId: idField,
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().positive().max(50_000_000),
  s3Key: z.string().min(1).max(1024),
});

export const deleteDocumentSchema = z.object({
  documentId: idField,
});

/**
 * Validates the full knowledgebase object as stored in the database.
 */
export const knowledgebaseSchema = z.object({
  id: idField,
  userId: z.string(),
  name: nameField,
  description: descriptionField,
  documentCount: z.number().int().nonnegative(),
  indexStatus: z.enum(["ready", "stale", "indexing"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});
