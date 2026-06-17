import type { InferSelectModel } from "drizzle-orm";
import type { knowledgebase } from "@/drizzle/schema";

export type KnowledgebaseRow = InferSelectModel<typeof knowledgebase>;
