import type { InferSelectModel } from "drizzle-orm";
import type { kbDocument } from "@/drizzle/schemas/kb-document-schema";

export type KbDocumentRow = InferSelectModel<typeof kbDocument>;
