"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import type { Result } from "@/types/result";

/**
 * Fetches all AI provider configurations for the authenticated user.
 * Returns providers sorted alphabetically by name.
 * Sensitive fields (encrypted API keys, headers) are returned encrypted — use decodeProviderRecord to decrypt.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Result containing array of provider records sorted by name.
 * @author Maruf Bepary
 */
export const listProviders = defineAction(
  async (): Promise<Result<AiProviderRow[], CommonError>> => {
    const session = await requireSession();

    const rows = await db
      .select()
      .from(aiProvider)
      .where(eq(aiProvider.userId, session.user.id))
      .orderBy(asc(aiProvider.name));

    return ok(
      rows.map((r) => ({
        ...r,
        apiKey: r.apiKey ? "[REDACTED]" : null,
        headers: r.headers ? "[REDACTED]" : null,
      })),
    );
  },
);
