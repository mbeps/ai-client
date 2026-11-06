"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { toEncryptedProviderValues } from "@/lib/providers/to-encrypted-provider-values";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import {
  type UpdateProviderInput,
  updateProviderSchema,
} from "@/schemas/providers/provider-registry";
import type { CommonError } from "@/types/error/common-error";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import type { Result } from "@/types/result";

/**
 * Updates an existing AI provider configuration with partial field updates.
 * Re-encrypts sensitive fields (API key, headers) if provided.
 * If API key or headers are not included in update, existing encrypted values are preserved.
 * Enforces ownership check before modifying provider.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param providerId - UUID of the provider to update; must be owned by the authenticated user.
 * @param input - Partial provider update object.
 * @returns Result containing the updated provider record with encrypted credentials.
 * @author Maruf Bepary
 */
export const updateProvider = defineAction(
  async (
    providerId: string,
    input: UpdateProviderInput,
  ): Promise<Result<AiProviderRow, CommonError>> => {
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
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
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
                encrypted.headers === null
                  ? existing.headers
                  : encrypted.headers,
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
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(updated);
  },
);
