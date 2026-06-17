"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/actions/require-session";
import {
  updateProviderSchema,
  type UpdateProviderInput,
} from "@/schemas/provider-registry";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import { toEncryptedProviderValues } from "./utils";

export async function updateProvider(
  providerId: string,
  input: UpdateProviderInput,
): Promise<AiProviderRow> {
  const session = await requireSession();
  const parsed = updateProviderSchema.parse(input);

  const [existing] = await db
    .select()
    .from(aiProvider)
    .where(
      and(
        eq(aiProvider.id, providerId),
        eq(aiProvider.userId, session.user.id),
      ),
    );

  if (!existing) {
    throw new Error("Not Found");
  }

  const encrypted =
    Object.prototype.hasOwnProperty.call(parsed, "apiKey") ||
    Object.prototype.hasOwnProperty.call(parsed, "headers")
      ? toEncryptedProviderValues({
          apiKey: parsed.apiKey,
          headers: parsed.headers,
        })
      : null;

  const [updated] = await db
    .update(aiProvider)
    .set({
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.baseUrl !== undefined ? { baseUrl: parsed.baseUrl } : {}),
      ...(parsed.isEnabled !== undefined
        ? { isEnabled: parsed.isEnabled }
        : {}),
      ...(parsed.requiresKey !== undefined
        ? { requiresKey: parsed.requiresKey }
        : {}),
      ...(encrypted
        ? {
            apiKey:
              encrypted.apiKey === null ? existing.apiKey : encrypted.apiKey,
            headers:
              encrypted.headers === null ? existing.headers : encrypted.headers,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiProvider.id, providerId),
        eq(aiProvider.userId, session.user.id),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Not Found");
  }

  return updated;
}
