import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { aiProvider } from "./ai-provider-schema";
import { user } from "./auth-schema";

/**
 * Stores provider models discovered from `/v1/models` or added manually by users.
 * Many-to-one with aiProvider and user (both CASCADE DELETE).
 * modelType controls usage scope: chat, embedding, or both.
 */
export const aiModel = pgTable(
  "ai_model",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    providerId: text("provider_id")
      .notNull()
      .references(() => aiProvider.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(),
    label: text("label").notNull(),
    modelType: text("model_type").notNull().default("chat"),
    contextWindow: integer("context_window").notNull().default(4096),
    embeddingDimensions: integer("embedding_dimensions"),
    capTools: boolean("cap_tools").notNull().default(false),
    capVision: boolean("cap_vision").notNull().default(false),
    capReasoning: boolean("cap_reasoning").notNull().default(false),
    capStructuredOutput: boolean("cap_structured_output")
      .notNull()
      .default(false),
    isManuallyAdded: boolean("is_manually_added").notNull().default(false),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      "ai_model_model_type_check",
      sql`${table.modelType} in ('chat', 'embedding', 'both')`,
    ),
    index("ai_model_provider_id_idx").on(table.providerId),
    index("ai_model_user_id_idx").on(table.userId),
    index("ai_model_user_id_model_type_idx").on(table.userId, table.modelType),
    uniqueIndex("ai_model_provider_id_model_id_idx").on(
      table.providerId,
      table.modelId,
    ),
  ],
);
