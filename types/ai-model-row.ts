import { type InferSelectModel } from "drizzle-orm";
import { aiModel } from "@/drizzle/schema";

/**
 * Database representation of an AI model discovered from a provider or added manually.
 */
export type AiModelRow = InferSelectModel<typeof aiModel>;

/**
 * AI model record extended with provider metadata for UI display.
 */
export type AiModelWithProvider = AiModelRow & {
  providerName: string;
};
