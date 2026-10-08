import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { chat } from "@/drizzle/schemas/chat-schema";

/**
 * Stores intermediate scratchpad files written and shared by subagents
 * during a chat execution turn.
 *
 * Scoped to a specific chat session and assistant message turn.
 * Automatically cascade-deleted when the parent chat is deleted.
 * Note: messageId omits a database-level FK to allow subagents to write intermediate
 * blackboard files in real time before the assistant message row is persisted.
 *
 * @author Maruf Bepary
 */
export const subagentScratchpad = pgTable(
  "subagent_scratchpad",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    filePath: text("file_path").notNull(),
    content: text("content").notNull(),
    writtenByRole: text("written_by_role").notNull(),
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("subagent_scratchpad_msg_filepath_idx").on(
      table.messageId,
      table.filePath,
    ),
    index("subagent_scratchpad_chat_msg_idx").on(table.chatId, table.messageId),
  ],
);
