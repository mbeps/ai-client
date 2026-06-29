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
 * Validates knowledgebase rename operations with only the new name field.
 * Requires name to be non-empty and under 100 characters.
 * Quick name changes without modifying description or documents.
 * Use with renameKnowledgebase server action for efficient name updates.
 *
 * @see {@link schemas/shared-fields.ts} for renameSchema definition
 * @author Maruf Bepary
 */
export const renameKnowledgebaseSchema = renameSchema;

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
 * Validates document addition to a knowledgebase.
 * Includes knowledgebase ID, file metadata (name, mimetype, size), and S3 storage key.
 * Size enforced at 50MB max per file; mimeType helps validate and render document types.
 * Use when uploading documents (PDF, TXT, XLSX) to a knowledge base.
 *
 * @author Maruf Bepary
 */
export const addDocumentSchema = z.object({
  kbId: idField,
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().positive().max(50_000_000),
  s3Key: z.string().min(1).max(1024),
});

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
