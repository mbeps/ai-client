"use server";

import { knowledgebase } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

export const deleteKnowledgebase = deleteEntityFactory({
  table: knowledgebase,
});
