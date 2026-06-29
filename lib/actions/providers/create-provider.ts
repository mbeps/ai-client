"use server";

import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import {
  createProviderSchema,
  type CreateProviderInput,
} from "@/schemas/providers/provider-registry";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import { toEncryptedProviderValues } from "./utils";

/**
 * Creates a new AI provider configuration for the authenticated user.
 * Encrypts sensitive fields (API key and custom headers) before storing in database.
 * Supports OpenAI-compatible providers with customisable base URLs and authentication headers.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param input - Provider configuration object validated against createProviderSchema (name, baseUrl, apiKey required; headers optional).
 * @returns The newly created provider record with encrypted credentials.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation (e.g., name or baseUrl missing).
 * @throws Error if database insertion fails due to constraints or connection issues.
 * @see updateProvider to modify provider settings.
 * @see testProviderConnection to verify provider connectivity.
 * @see deleteProvider to remove a provider.
 * @author Maruf Bepary
 */
export async function createProvider(
  input: CreateProviderInput,
): Promise<AiProviderRow> {
  const session = await requireSession();
  const parsed = createProviderSchema.parse(input);

  const encrypted = toEncryptedProviderValues({
    apiKey: parsed.apiKey,
    headers: parsed.headers,
  });

  const [created] = await db
    .insert(aiProvider)
    .values({
      userId: session.user.id,
      name: parsed.name,
      baseUrl: parsed.baseUrl,
      apiKey: encrypted.apiKey,
      headers: encrypted.headers,
      isEnabled: parsed.isEnabled ?? true,
      requiresKey: parsed.requiresKey ?? true,
    })
    .returning();

  return created;
}
