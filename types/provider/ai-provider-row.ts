import { type InferSelectModel } from "drizzle-orm";
import { aiProvider } from "@/drizzle/schema";

/**
 * Database representation of a user-configured OpenAI-compatible AI provider.
 * From the Drizzle schema; enables persistence of provider endpoints and credentials.
 * Users can configure custom providers (OpenRouter, Ollama, Azure, DeepSeek, etc.)
 * alongside built-in providers for flexible model selection.
 *
 * @see {@link types/provider/ai-model-row.ts} for models from this provider
 * @author Maruf Bepary
 */
export type AiProviderRow = InferSelectModel<typeof aiProvider>;
