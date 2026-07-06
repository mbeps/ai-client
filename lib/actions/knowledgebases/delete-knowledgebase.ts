"use server";

import { knowledgebase } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

/**
 * Deletes one or more knowledge bases and all associated documents for the authenticated user.
 * Cascade-deletes all documents and their S3 references via foreign key constraints.
 * Runs on server only — never call from client components.
 *
 * @param idOrIds - UUID or array of UUIDs of the knowledge bases to delete; must be owned by the authenticated user.
 * @returns { deletedCount: number } - The number of knowledge bases successfully deleted.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if knowledge base is not found or user does not own it (ownership check enforced via session).
 * @throws Error if database deletion fails due to constraints or connection issues.
 * @see createKnowledgebase to create a new knowledge base.
 * @see updateKnowledgebase to modify knowledge base settings.
 * @author Maruf Bepary
 */
export const deleteKnowledgebase = deleteEntityFactory({
  table: knowledgebase,
});
