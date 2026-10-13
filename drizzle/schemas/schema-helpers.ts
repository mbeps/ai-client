import { text, timestamp } from "drizzle-orm/pg-core";
import { user } from "@/drizzle/schemas/auth-schema";

/**
 * Standard auto-generated UUID primary key column definition.
 * Used across application entities for consistent UUID identification.
 */
export const entityIdColumn = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/**
 * Standard user ownership foreign key column definition with CASCADE delete.
 * References the auth user table.
 */
export const userForeignKeyColumn = () =>
  text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

/**
 * Standard createdAt and updatedAt timestamp columns with defaultNow and onUpdate hooks.
 */
export const timestampColumns = () => ({
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

