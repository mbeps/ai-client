"use server";

import { knowledgebase } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

/**
 * Deletes a knowledge base and all associated documents for the authenticated user.
 * Cascade-deletes all documents and their S3 references via foreign key constraints.
 * Runs on server only — never call from client components.
 *
 * @param id - UUID of the knowledge base to delete; must be owned by the authenticated user.
 * @returns void (no return value).
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
