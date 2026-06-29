import { type InferSelectModel } from "drizzle-orm";
import { userSettings } from "@/drizzle/schema";

/**
 * Database representation of user-wide settings from the Drizzle schema.
 * One-to-one with user account; stores global preferences and AI configuration.
 * globalSystemPrompt prepends to all AI interactions when set, enabling default behavior customization.
 *
 * @see {@link schemas/user/user-settings.ts} for validation schema
 * @author Maruf Bepary
 */
export type UserSettingsRow = InferSelectModel<typeof userSettings>;
