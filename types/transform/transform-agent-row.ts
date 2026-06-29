import { type InferSelectModel } from "drizzle-orm";
import { transformAgent } from "@/drizzle/schema";

/**
 * Database representation of a transform agent (multi-step workflow) from the Drizzle schema.
 * Stores all workflow metadata for persistence and retrieval.
 *
 * @see {@link types/transform/transform-agent.ts} for enriched TransformAgent type
 * @see {@link types/transform/transform-run.ts} for execution instances
 * @author Maruf Bepary
 */
export type TransformAgentRow = InferSelectModel<typeof transformAgent>;
