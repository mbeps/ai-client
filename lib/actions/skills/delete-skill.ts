"use server";

import { skill } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

/**
 * Deletes an Agent Skill by ID, verifying ownership by the authenticated user.
 *
 * @author Maruf Bepary
 */
export const deleteSkill = deleteEntityFactory({
  table: skill,
});
