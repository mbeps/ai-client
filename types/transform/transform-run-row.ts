import { type InferSelectModel } from "drizzle-orm";
import { transformRun } from "@/drizzle/schema";

/**
 * Database representation of a transform run execution from the Drizzle schema.
 * Stores all execution metadata for persistence, auditing, and recovery.
 *
 * @see {@link types/transform/transform-run.ts} for enriched TransformRun type
 * @see {@link types/transform/transform-agent-row.ts} for the workflow definition
 * @author Maruf Bepary
 */
export type TransformRunRow = InferSelectModel<typeof transformRun>;
