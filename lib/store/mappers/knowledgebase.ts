import type { KnowledgebaseRow } from "@/types/knowledgebase-row";
import type { Knowledgebase } from "@/types/knowledgebase";

export function knowledgebaseRowToStore(row: KnowledgebaseRow): Knowledgebase {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    documentCount: 0,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
