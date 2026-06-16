"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/actions/require-session";
import { isBlockedUrl } from "@/lib/mcp/url-guard";
import { logger } from "@/lib/logger";
import { decodeProviderRecord } from "./utils";

export type ProviderConnectionResult = {
  ok: boolean;
  error?: string;
};

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

  if (isBlockedUrl(provider.baseUrl)) {
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
