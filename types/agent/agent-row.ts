import type { InferSelectModel } from "drizzle-orm";
import type { agent } from "@/drizzle/schemas/agent-schema";
import type { TimedResource } from "@/types/shared/resource";

/**
 * Database row representation of a unified AI Agent from the Drizzle schema.
 */
export type AgentRow = InferSelectModel<typeof agent> & TimedResource;
