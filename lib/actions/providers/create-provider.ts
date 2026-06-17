"use server";

import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/actions/require-session";
import {
  createProviderSchema,
  type CreateProviderInput,
} from "@/schemas/providers/provider-registry";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import { toEncryptedProviderValues } from "./utils";

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
