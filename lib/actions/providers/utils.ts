import { aiProvider } from "@/drizzle/schema";
import type { AiProviderRow } from "@/types/ai-provider-row";
import { decrypt, encrypt } from "@/lib/utils/encryption";
import { ProviderKeyCorruptedError } from "@/lib/constants/errors";
import { logger } from "@/lib/logger";

export type ProviderHeaders = Record<string, string>;

export type ProviderRecord = {
  row: AiProviderRow;
  apiKey: string | null;
  headers: ProviderHeaders;
};

export function normaliseProviderApiKey(
  apiKey: string | null | undefined,
): string | null {
  const value = apiKey?.trim();
  return value ? value : null;
}

export function serialiseProviderHeaders(
  headers: ProviderHeaders | undefined,
): string | null {
  if (!headers) return null;

  const entries = Object.entries(headers).filter(
    ([name, value]) => name.trim().length > 0 && value.trim().length > 0,
  );

  if (entries.length === 0) return null;

  return JSON.stringify(Object.fromEntries(entries));
}

export function parseProviderHeaders(raw: string | null): ProviderHeaders {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const output: ProviderHeaders = {};
    for (const [name, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        output[name] = value;
      }
    }

    return output;
  } catch {
    return {};
  }
}

export function toEncryptedProviderValues(input: {
  apiKey?: string | null;
  headers?: ProviderHeaders;
}): Pick<typeof aiProvider.$inferInsert, "apiKey" | "headers"> {
  const apiKey = normaliseProviderApiKey(input.apiKey);
  const serialisedHeaders = serialiseProviderHeaders(input.headers);

  return {
    apiKey: apiKey ? encrypt(apiKey) : null,
    headers: serialisedHeaders ? encrypt(serialisedHeaders) : null,
  };
}

export function decodeProviderRecord(row: AiProviderRow): ProviderRecord {
  let apiKey: string | null = null;
  let headers: ProviderHeaders = {};

  if (row.apiKey) {
    try {
      apiKey = decrypt(row.apiKey);
    } catch (err) {
      logger.error(
        "Failed to decrypt provider field",
        err,
        { field: "apiKey", providerId: row.id, userId: row.userId },
        row.userId,
      );
      throw new ProviderKeyCorruptedError(
        `Provider key is corrupted for provider '${row.name}'`,
      );
    }
  }

  if (row.headers) {
    try {
      const decryptedHeaders = decrypt(row.headers);
      headers = parseProviderHeaders(decryptedHeaders);
    } catch (err) {
      logger.error(
        "Failed to decrypt provider field",
        err,
        { field: "headers", providerId: row.id, userId: row.userId },
        row.userId,
      );
      throw new ProviderKeyCorruptedError(
        `Provider headers are corrupted for provider '${row.name}'`,
      );
    }
  }

  return { row, apiKey, headers };
}

export function maskProviderKey(apiKey: string | null): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 8) return "••••";
  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}
