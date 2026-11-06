"use server";

import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { toEncryptedProviderValues } from "@/lib/providers/to-encrypted-provider-values";
import { ok } from "@/lib/result/ok";
import {
  type CreateProviderInput,
  createProviderSchema,
} from "@/schemas/providers/provider-registry";
import type { CommonError } from "@/types/error/common-error";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import type { Result } from "@/types/result";

/**
 * Creates a new AI provider configuration for the authenticated user.
 * Encrypts sensitive fields (API key and custom headers) before storing in database.
 * Supports OpenAI-compatible providers with customisable base URLs and authentication headers.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param input - Provider configuration object validated against createProviderSchema.
 * @returns Result containing the newly created provider record with encrypted credentials.
 * @author Maruf Bepary
 */
export const createProvider = defineAction(
  async (
    input: CreateProviderInput,
  ): Promise<Result<AiProviderRow, CommonError>> => {
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

    return ok(created);
  },
);
