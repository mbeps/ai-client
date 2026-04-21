import {
  integer,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const chat = pgTable(
  "chat",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id"),
    assistantId: text("assistant_id"),
    currentLeafId: text("current_leaf_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("chat_user_id_idx").on(table.userId)],
);

export const message = pgTable(
  "message",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant" | "system">().notNull(),
    content: text("content").notNull(),
    // No DB-level FK on parentId — self-referential cycles cause issues with cascade order.
    // Tree traversal (parentId/childrenIds) is handled at the application layer.
    parentId: text("parent_id"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("message_chat_id_idx").on(table.chatId)],
);

export const attachment = pgTable(
  "attachment",
  {
    id: text("id").primaryKey(),
    messageId: text("message_id")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    key: text("key").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("attachment_message_id_idx").on(table.messageId),
    index("attachment_user_id_idx").on(table.userId),
    uniqueIndex("attachment_key_idx").on(table.key),
  ],
);
