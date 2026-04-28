import {
  integer,
  pgTable,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

/**
 * Stores chat sessions scoped to users, optional projects, and optional assistants.
 * Links messages via chatId; supports many-to-one with user (CASCADE DELETE).
 * currentLeafId tracks the active message in branching conversation trees.
 *
 * @author Maruf Bepary
 */
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

/**
 * Stores individual messages within a chat, organised into branching tree via parentId.
 * Many-to-one with chat (CASCADE DELETE); no DB-level foreign key on parentId to avoid cascading issues with self-referential trees.
 * Tree traversal and branch logic handled at the application layer (see message-bubble.tsx for rendering).
 * role enum: 'user', 'assistant', 'system'; metadata stores JSON tool calls and reasoning tokens.
 *
 * @author Maruf Bepary
 */
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

/**
 * Stores uploaded files (images, PDFs, text, spreadsheets) linked to messages.
 * Many-to-one with message and user (both CASCADE DELETE); key is UNIQUE and points to S3 object path.
 * MIME type and size metadata enable validation and rendering in chat UI; name preserves original filename.
 *
 * @author Maruf Bepary
 */
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
