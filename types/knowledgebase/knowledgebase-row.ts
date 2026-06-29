import type { InferSelectModel } from "drizzle-orm";
import type { knowledgebase } from "@/drizzle/schema";

/**
 * Database representation of a knowledge base from the Drizzle schema.
 * Stores all knowledgebase metadata for persistence and retrieval.
 * Part of the rich entity model for document-based AI context.
 *
 * @see {@link types/knowledgebase/knowledgebase.ts} for enriched Knowledgebase type
 * @see {@link types/knowledgebase/kb-document-row.ts} for documents in this KB
 * @author Maruf Bepary
 */
export type KnowledgebaseRow = InferSelectModel<typeof knowledgebase>;
