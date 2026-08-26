import { z } from "zod";
import {
  nameField,
  descriptionField,
  idField,
} from "../shared-fields";

/**
 * Validates new knowledgebase creation with name and optional description.
 * Name required (1-100 chars); description optional (max 500 chars).
 * Knowledge bases are document collections providing AI context for projects and assistants.
 * Use with createKnowledgebase server action to create new information repositories.
 * Documents can be indexed for semantic search and RAG (Retrieval Augmented Generation).
 *
 * @see {@link types/knowledgebase/knowledgebase.ts} for database representation
 * @author Maruf Bepary
 */
export const createKnowledgebaseSchema = z.object({
  name: nameField,
  description: descriptionField,
});

/**
 * Validates updates to an existing knowledgebase.
 * Includes optional name and description for selective field updates.
 * Omitted fields preserve existing values.
 * Use with updateKnowledgebase server action for consolidated metadata updates.
 *
 * @author Maruf Bepary
 */
export const updateKnowledgebaseSchema = createKnowledgebaseSchema.partial();

/**
 * Validates document deletion from a knowledgebase.
 * Requires only the documentId for targeted removal.
 * Use when removing documents from a knowledge base.
 *
 * @author Maruf Bepary
 */
export const deleteDocumentSchema = z.object({
  documentId: idField,
});

/**
 * Validates the full knowledgebase object as stored in the database and loaded in the store.
 * Includes all fields from creation plus system metadata (id, userId, timestamps).
 * documentCount tracks number of indexed documents.
 * indexStatus indicates whether the knowledge base is ready, stale, or currently indexing.
 * Use for type-safe store hydration and API serialization.
 *
 * @author Maruf Bepary
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
