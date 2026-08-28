import { type InferSelectModel } from "drizzle-orm";
import { skill } from "@/drizzle/schema";
import { TimedResource } from "../shared/resource";

/**
 * Database row representation of an Agent Skill from the Drizzle schema.
 *
 * @see {@link types/skill/skill.ts} for enriched Skill type
 * @author Maruf Bepary
 */
export type SkillRow = InferSelectModel<typeof skill> & TimedResource;
