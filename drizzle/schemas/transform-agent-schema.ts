import {
  pgTable,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const transformAgent = pgTable(
  "transform_agent",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    modelId: text("model_id"),
    steps: text("steps").notNull().default("[]"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("transform_agent_user_id_idx").on(table.userId)],
);

export const transformRun = pgTable(
  "transform_run",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    agentId: text("agent_id")
      .notNull()
      .references(() => transformAgent.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status")
      .$type<
        "pending" | "running" | "awaiting_review" | "completed" | "failed"
      >()
      .notNull()
      .default("pending"),
    currentStepIndex: integer("current_step_index"),
    dryRun: boolean("dry_run").notNull().default(false),
    inputAttachmentIds: text("input_attachment_ids").notNull().default("[]"),
    outputAttachmentIds: text("output_attachment_ids").notNull().default("[]"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("transform_run_agent_id_idx").on(table.agentId),
    index("transform_run_user_id_idx").on(table.userId),
  ],
);
