"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schemas/ai-provider-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { isBlockedUrl } from "@/lib/mcp/url-guard/is-blocked-url";
import { decodeProviderRecord } from "@/lib/providers/decode-provider-record";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "provider"]);

export type TestProviderConnectionSuccess = {
  readonly connected: true;
};

export type TestProviderConnectionError =
  | CommonError
  | {
      readonly code: typeof ERROR_CODE.UPSTREAM_HTTP;
      readonly message: string;
      readonly status?: number;
      readonly url?: string;
    };

/**
 * Tests connectivity to an AI provider by making a test API call to the /models endpoint.
 * Validates provider configuration (URL, credentials, headers) without throwing unhandled errors.
 * Enforces SSRF URL guard checks to prevent server-side request forgery.
 * Returns a Result object with ok flag and typed error for client-side error handling.
 * Logs test results for debugging and audit purposes.
 * Runs on server only — invoked from client to verify provider setup before saving.
 *
 * @param providerId - UUID of the provider to test; must be owned by the authenticated user.
 * @returns Result containing connection confirmation or typed error.
 * @author Maruf Bepary
 */
export const testProviderConnection = defineAction(
  async (
    providerId: string,
  ): Promise<
    Result<TestProviderConnectionSuccess, TestProviderConnectionError>
  > => {
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
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Provider not found",
      });
    }

    if (await isBlockedUrl(provider.baseUrl)) {
      return fail({
        code: ERROR_CODE.FORBIDDEN,
        message: "Provider URL is blocked by SSRF guard",
      });
    }

    const decoded = decodeProviderRecord(provider);
    const targetUrl = `${decoded.row.baseUrl.replace(/\/$/, "")}/models`;

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          ...(decoded.apiKey
            ? { Authorization: `Bearer ${decoded.apiKey}` }
            : {}),
          ...decoded.headers,
        },
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        log.warn(
          "Provider connection test failed (status: {status}, providerId: {providerId})",
          { providerId, status: response.status, userId: session.user.id },
        );
        const parsed = new URL(targetUrl);
        const cleanUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
        return fail({
          code: ERROR_CODE.UPSTREAM_HTTP,
          message:
            response.status === 404
              ? `The provider returned HTTP 404 for ${cleanUrl}. Check the base URL (it usually ends with /v1).`
              : `Provider responded with status ${response.status}`,
          status: response.status,
          url: cleanUrl,
        });
      }

      log.info(
        "Provider connection test successful (providerId: {providerId})",
        {
          providerId,
          userId: session.user.id,
        },
      );
      return ok({ connected: true });
    } catch (error) {
      log.error(
        "Provider connection test failed (providerId: {providerId}): {error}",
        {
          providerId,
          error: error instanceof Error ? error.message : String(error),
          userId: session.user.id,
        },
      );
      return fail({
        code: ERROR_CODE.UPSTREAM_HTTP,
        message:
          error instanceof Error ? error.message : "Connection test failed",
      });
    }
  },
);
