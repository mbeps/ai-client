"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { isBlockedUrl } from "@/lib/mcp/url-guard";
import { logger } from "@/lib/logger";
import { decodeProviderRecord } from "./utils";

export type ProviderConnectionResult = {
  ok: boolean;
  error?: string;
};

/**
 * Tests connectivity to an AI provider by making a test API call to the /models endpoint.
 * Validates provider configuration (URL, credentials, headers) without throwing errors.
 * Enforces SSRF URL guard checks to prevent server-side request forgery.
 * Returns a result object with ok flag and optional error message for client-side error handling.
 * Logs test results for debugging and audit purposes.
 * Runs on server only — invoked from client to verify provider setup before saving.
 *
 * @param providerId - UUID of the provider to test; must be owned by the authenticated user.
 * @returns ProviderConnectionResult object with ok (boolean) and optional error (string) message.
 * @throws Error if session is not authenticated.
 * @see createProvider to add a new provider.
 * @see updateProvider to modify provider settings after testing.
 * @author Maruf Bepary
 */
export async function testProviderConnection(
  providerId: string,
): Promise<ProviderConnectionResult> {
  const session = await requireSession();

  const [provider] = await db
    .select()
    .from(aiProvider)
    .where(
      and(
        eq(aiProvider.id, providerId),
        eq(aiProvider.userId, session.user.id),
      ),
    );

  if (!provider) {
    return { ok: false, error: "Provider not found" };
  }

  if (await isBlockedUrl(provider.baseUrl)) {
    return { ok: false, error: "Provider URL is blocked by SSRF guard" };
  }

  try {
    const decoded = decodeProviderRecord(provider);

    const response = await fetch(
      `${decoded.row.baseUrl.replace(/\/$/, "")}/models`,
      {
        method: "GET",
        headers: {
          ...(decoded.apiKey
            ? { Authorization: `Bearer ${decoded.apiKey}` }
            : {}),
          ...decoded.headers,
        },
      },
    );

    if (!response.ok) {
      logger.warn(
        "Provider connection test failed with status",
        { providerId, status: response.status },
        session.user.id,
      );
      return {
        ok: false,
        error: `Provider responded with status ${response.status}`,
      };
    }

    logger.info(
      "Provider connection test successful",
      { providerId, userId: session.user.id },
      session.user.id,
    );
    return { ok: true };
  } catch (error) {
    logger.error(
      "Provider connection test failed",
      error,
      { providerId, userId: session.user.id },
      session.user.id,
    );
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Connection test failed",
    };
  }
}
