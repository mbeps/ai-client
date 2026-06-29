import { z } from "zod";
import { knowledgebaseSchema } from "@/schemas/knowledgebase/knowledgebase";

/**
 * A named document collection providing AI context for projects and assistants.
 * Supports semantic search and Retrieval Augmented Generation (RAG) for document-based knowledge.
 * Tracks document count and indexing status for UI display and search availability.
 * Derived from Zod schema for validation and type safety.
 *
 * @see {@link schemas/knowledgebase/knowledgebase.ts} for creation/update validation
 * @see {@link types/knowledgebase/knowledgebase-row.ts} for database representation
 * @see {@link types/knowledgebase/kb-document-row.ts} for documents in this KB
 * @author Maruf Bepary
 */
export type Knowledgebase = z.infer<typeof knowledgebaseSchema>;
