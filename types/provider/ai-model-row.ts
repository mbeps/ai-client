import { type InferSelectModel } from "drizzle-orm";
import { aiModel } from "@/drizzle/schema";

/**
 * Database representation of an AI model discovered from a provider or added manually.
 * From the Drizzle schema; includes model capabilities and metadata.
 * Tracks context window, embedding dimensions, and supported features (tools, vision, reasoning).
 *
 * @see {@link types/provider/ai-provider-row.ts} for the provider that hosts this model
 * @author Maruf Bepary
 */
export type AiModelRow = InferSelectModel<typeof aiModel>;
