"use server";

import { knowledgebase } from "@/drizzle/schema";
import { createKnowledgebaseSchema } from "@/schemas/knowledgebase/knowledgebase";
import { createEntityFactory } from "@/lib/actions/shared/create-entity-factory";
import { resolveEmbeddingProvider } from "@/lib/chat/resolve-embedding-provider";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";
import { z } from "zod";

/**
 * Creates a new knowledge base for the authenticated user.
 * Verifies embedding configuration before creating the record.
 *
 * @param data - Knowledge base configuration (name required, description optional).
 * @returns The newly created knowledge base record.
 * @throws Error if session is not authenticated or no embedding provider is configured.
 */
export const createKnowledgebase = createEntityFactory<
  z.infer<typeof createKnowledgebaseSchema>,
  KnowledgebaseRow
>({
  table: knowledgebase,
  schema: createKnowledgebaseSchema,
  beforeValidate: async (_data, userId) => {
    await resolveEmbeddingProvider(userId);
  },
  mapValues: (validated, userId) => ({
    name: validated.name,
    description: validated.description ?? null,
    userId,
    indexStatus: "ready",
    lastIndexedAt: null,
  }),
});
