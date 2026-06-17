import { type InferSelectModel } from "drizzle-orm";
import { aiProvider } from "@/drizzle/schema";

/**
 * Database representation of a user-configured OpenAI-compatible provider.
 */
export type AiProviderRow = InferSelectModel<typeof aiProvider>;
