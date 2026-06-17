import { type InferSelectModel } from "drizzle-orm";
import { userSettings } from "@/drizzle/schema";

/**
 * Database representation of user-wide settings (e.g., global system prompt) from the drizzle schema.
 * One-to-one with user; globalSystemPrompt prepends all AI interactions.
 *
 * @see {@link ../drizzle/schemas/user-settings-schema.ts} for database definition
 * @author Maruf Bepary
 */
export type UserSettingsRow = InferSelectModel<typeof userSettings>;
