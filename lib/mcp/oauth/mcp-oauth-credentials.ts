import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db as defaultDb } from "@/drizzle/db";
import { mcpOAuthCredential } from "@/drizzle/schemas/mcp-server-schema";
import { decrypt } from "@/lib/encryption/decrypt";
import { encrypt } from "@/lib/encryption/encrypt";

type Database = any;

/**
 * Safely decrypts a string if it matches ciphertext format; falls back gracefully.
 */
function safeDecrypt(val?: string | null): string | null {
  if (!val) return null;
  try {
    return decrypt(val);
  } catch {
    return val;
  }
}

/**
 * Safely decrypts and parses JSON object.
 */
function safeDecryptJson<T = any>(
  val?: string | null | Record<string, any>,
): T | null {
  if (!val) return null;
  if (typeof val === "object") return val as unknown as T;
  const decrypted = safeDecrypt(val);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

export type DecryptedMcpOAuthCredential = {
  id: string;
  userId: string;
  serverId: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  scope: string | null;
  accessTokenExpiresAt: Date | null;
  clientInformation: Record<string, any> | null;
  authorizationServerInfo: Record<string, any> | null;
  codeVerifier: string | null;
  oauthState: string | null;
  stateExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Retrieves per-user OAuth credentials for a specific MCP server.
 * Decrypts accessToken, refreshToken, codeVerifier, and clientInformation at rest.
 *
 * @param db - Drizzle database instance
 * @param param1 - Object containing userId and serverId
 * @returns Decrypted credential object or null if not found
 */
export async function getMcpOAuthCredential(
  db: Database = defaultDb,
  { userId, serverId }: { userId: string; serverId: string },
): Promise<DecryptedMcpOAuthCredential | null> {
  const row = await db.query.mcpOAuthCredential.findFirst({
    where: and(
      eq(mcpOAuthCredential.userId, userId),
      eq(mcpOAuthCredential.serverId, serverId),
    ),
  });

  if (!row) return null;

  return {
    ...row,
    accessToken: safeDecrypt(row.accessToken),
    refreshToken: safeDecrypt(row.refreshToken),
    codeVerifier: safeDecrypt(row.codeVerifier),
    clientInformation: safeDecryptJson(row.clientInformation),
    authorizationServerInfo: safeDecryptJson(row.authorizationServerInfo),
  };
}

/**
 * Retrieves per-user OAuth credentials by active OAuth state parameter.
 * Enforces state expiry check.
 *
 * @param db - Drizzle database instance
 * @param state - OAuth state string from callback
 * @returns Decrypted credential row or null if not found or expired
 */
export async function getMcpOAuthCredentialByState(
  db: Database = defaultDb,
  state: string,
): Promise<DecryptedMcpOAuthCredential | null> {
  const now = new Date();
  const row = await db.query.mcpOAuthCredential.findFirst({
    where: and(
      eq(mcpOAuthCredential.oauthState, state),
      or(
        isNull(mcpOAuthCredential.stateExpiresAt),
        gt(mcpOAuthCredential.stateExpiresAt, now),
      ),
    ),
  });

  if (!row) return null;

  return {
    ...row,
    accessToken: safeDecrypt(row.accessToken),
    refreshToken: safeDecrypt(row.refreshToken),
    codeVerifier: safeDecrypt(row.codeVerifier),
    clientInformation: safeDecryptJson(row.clientInformation),
    authorizationServerInfo: safeDecryptJson(row.authorizationServerInfo),
  };
}

export type SaveMcpOAuthCredentialInput = {
  userId: string;
  serverId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  accessTokenExpiresAt?: Date | null;
  clientInformation?: Record<string, any> | null;
  authorizationServerInfo?: Record<string, any> | null;
  codeVerifier?: string | null;
  oauthState?: string | null;
  stateExpiresAt?: Date | null;
};

/**
 * Upserts per-user OAuth credentials. Encrypts sensitive fields (tokens, codeVerifier, clientInformation).
 *
 * @param db - Drizzle database instance
 * @param input - Credential fields to save
 */
export async function saveMcpOAuthCredential(
  db: Database = defaultDb,
  input: SaveMcpOAuthCredentialInput,
): Promise<void> {
  const valuesToInsert: Record<string, any> = {
    userId: input.userId,
    serverId: input.serverId,
    updatedAt: new Date(),
  };

  const setUpdate: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (input.accessToken !== undefined) {
    const enc = input.accessToken ? encrypt(input.accessToken) : null;
    valuesToInsert.accessToken = enc;
    setUpdate.accessToken = enc;
  }
  if (input.refreshToken !== undefined) {
    const enc = input.refreshToken ? encrypt(input.refreshToken) : null;
    valuesToInsert.refreshToken = enc;
    setUpdate.refreshToken = enc;
  }
  if (input.tokenType !== undefined) {
    valuesToInsert.tokenType = input.tokenType;
    setUpdate.tokenType = input.tokenType;
  }
  if (input.scope !== undefined) {
    valuesToInsert.scope = input.scope;
    setUpdate.scope = input.scope;
  }
  if (input.accessTokenExpiresAt !== undefined) {
    valuesToInsert.accessTokenExpiresAt = input.accessTokenExpiresAt;
    setUpdate.accessTokenExpiresAt = input.accessTokenExpiresAt;
  }
  if (input.clientInformation !== undefined) {
    const enc = input.clientInformation
      ? encrypt(JSON.stringify(input.clientInformation))
      : null;
    valuesToInsert.clientInformation = enc;
    setUpdate.clientInformation = enc;
  }
  if (input.authorizationServerInfo !== undefined) {
    const jsonStr = input.authorizationServerInfo
      ? JSON.stringify(input.authorizationServerInfo)
      : null;
    valuesToInsert.authorizationServerInfo = jsonStr;
    setUpdate.authorizationServerInfo = jsonStr;
  }
  if (input.codeVerifier !== undefined) {
    const enc = input.codeVerifier ? encrypt(input.codeVerifier) : null;
    valuesToInsert.codeVerifier = enc;
    setUpdate.codeVerifier = enc;
  }
  if (input.oauthState !== undefined) {
    valuesToInsert.oauthState = input.oauthState;
    setUpdate.oauthState = input.oauthState;
  }
  if (input.stateExpiresAt !== undefined) {
    valuesToInsert.stateExpiresAt = input.stateExpiresAt;
    setUpdate.stateExpiresAt = input.stateExpiresAt;
  }

  await db
    .insert(mcpOAuthCredential)
    .values(valuesToInsert)
    .onConflictDoUpdate({
      target: [mcpOAuthCredential.userId, mcpOAuthCredential.serverId],
      set: setUpdate,
    });
}

/**
 * Deletes per-user OAuth credentials for a server.
 *
 * @param db - Drizzle database instance
 * @param param1 - Object containing userId and serverId
 */
export async function deleteMcpOAuthCredential(
  db: Database = defaultDb,
  { userId, serverId }: { userId: string; serverId: string },
): Promise<void> {
  await db
    .delete(mcpOAuthCredential)
    .where(
      and(
        eq(mcpOAuthCredential.userId, userId),
        eq(mcpOAuthCredential.serverId, serverId),
      ),
    );
}
