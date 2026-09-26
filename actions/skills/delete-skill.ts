"use server";

import { deleteEntityFactory } from "@/actions/shared/delete-entity-factory";
import { skill } from "@/drizzle/schema";

/**
 * Deletes an Agent Skill by ID, verifying ownership by the authenticated user.
 *
 * @author Maruf Bepary
 */
export const deleteSkill = deleteEntityFactory({
  table: skill,
});
