// Must be imported first so side-effect runs before @/config/env evaluates
import "./load-env";

import { hashPassword } from "@better-auth/utils/password";
import { eq, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  account,
  aiModel,
  aiProvider,
  mcpServer,
  user,
  userSettings,
} from "@/drizzle/schema";
import { toEncryptedProviderValues } from "@/lib/providers/provider-utils";
import { ensureQdrantCollection } from "@/lib/rag/qdrant-client";
import { ensureBucket } from "@/lib/storage/ensure-bucket";

export const E2E_USER_ID = "e2euser0000000000000000000000001";
export const E2E_EMAIL = "e2e@test.com";
export const E2E_PASSWORD = "Hello123";
export const E2E_LOGOUT_USER_ID = "e2euserlogout0000000000000001";
export const E2E_LOGOUT_EMAIL = "logout-test@test.com";
export const E2E_PROVIDER_ID = "e2eprovider0000000000000000001";
export const E2E_CHAT_MODEL_ID = "e2emodelchat000000000000000001";
export const E2E_EMBED_MODEL_ID = "e2emodelembed000000000000000001";

/**
 * Resets and deterministically seeds the test environment for E2E runs.
 *
 * Ensures the `e2e@test.com` user is freshly initialized with:
 * - A pre-configured Mock AI Provider (`http://127.0.0.1:4000/v1`)
 * - Enabled chat model `mock-gpt-4o` and embedding model `mock-text-embedding-3`
 * - Valid userSettings pointing to those mock models
 * - Verified S3 bucket and Qdrant vector collection
 */
export async function seedE2eDatabase() {
  console.log("🌱 Starting E2E database reset and seed...");

  // 1. Delete previous E2E user records & accounts
  await db
    .delete(account)
    .where(
      or(
        eq(account.id, "e2eaccount00000000000000000001"),
        eq(account.id, "e2eaccountlogout0000000000000001"),
        eq(account.userId, E2E_USER_ID),
        eq(account.userId, E2E_LOGOUT_USER_ID),
      ),
    );

  const existingUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(
      or(
        eq(user.id, E2E_USER_ID),
        eq(user.email, E2E_EMAIL),
        eq(user.id, E2E_LOGOUT_USER_ID),
        eq(user.email, E2E_LOGOUT_EMAIL),
      ),
    );

  for (const u of existingUsers) {
    await db.delete(user).where(eq(user.id, u.id));
  }

  // 2. Insert fresh E2E user
  const now = new Date();
  await db.insert(user).values([
    {
      id: E2E_USER_ID,
      name: "E2E Test User",
      email: E2E_EMAIL,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: E2E_LOGOUT_USER_ID,
      name: "Logout Test User",
      email: E2E_LOGOUT_EMAIL,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // 3. Insert Better Auth credential accounts
  const hashedPassword = await hashPassword(E2E_PASSWORD);
  await db.insert(account).values([
    {
      id: "e2eaccount00000000000000000001",
      userId: E2E_USER_ID,
      accountId: E2E_USER_ID,
      providerId: "credential",
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "e2eaccountlogout0000000000000001",
      userId: E2E_LOGOUT_USER_ID,
      accountId: E2E_LOGOUT_USER_ID,
      providerId: "credential",
      password: hashedPassword,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // 4. Insert Mock AI Provider
  const encrypted = toEncryptedProviderValues({
    apiKey: "mock-key",
    headers: {},
  });
  await db.insert(aiProvider).values({
    id: E2E_PROVIDER_ID,
    userId: E2E_USER_ID,
    name: "Mock E2E Provider",
    baseUrl: "http://127.0.0.1:4000/v1",
    apiKey: encrypted.apiKey,
    headers: encrypted.headers,
    isEnabled: true,
    requiresKey: true,
    createdAt: now,
    updatedAt: now,
  });

  // 5. Insert Mock Models
  await db.insert(aiModel).values([
    {
      id: E2E_CHAT_MODEL_ID,
      providerId: E2E_PROVIDER_ID,
      userId: E2E_USER_ID,
      modelId: "mock-gpt-4o",
      label: "Mock GPT-4o",
      modelType: "chat",
      contextWindow: 128000,
      capTools: true,
      capVision: true,
      capReasoning: true,
      capStructuredOutput: true,
      isEnabled: true,
      isManuallyAdded: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: E2E_EMBED_MODEL_ID,
      providerId: E2E_PROVIDER_ID,
      userId: E2E_USER_ID,
      modelId: "mock-text-embedding-3",
      label: "Mock Embedding",
      modelType: "embedding",
      contextWindow: 8192,
      embeddingDimensions: 1024,
      isEnabled: true,
      isManuallyAdded: true,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // 6. Insert User Settings with Default Models
  await db.insert(userSettings).values({
    userId: E2E_USER_ID,
    defaultChatModelId: E2E_CHAT_MODEL_ID,
    defaultEmbeddingModelId: E2E_EMBED_MODEL_ID,
    memoryEnabled: true,
    globalSystemPrompt: "You are a helpful E2E testing assistant.",
    createdAt: now,
    updatedAt: now,
  });

  // 7. Insert Mock MCP Servers (local user + community public server)
  await db.insert(mcpServer).values({
    id: "e2emcpserver0000000000000001",
    userId: E2E_USER_ID,
    name: "Mock Local MCP",
    url: "http://127.0.0.1:4000/mcp",
    headers: JSON.stringify({}),
    enabled: true,
    isPublic: false,
    createdAt: now,
    updatedAt: now,
  });

  const COMM_USER_ID = "e2ecommuser000000000000000001";
  await db
    .insert(user)
    .values({
      id: COMM_USER_ID,
      name: "Community Publisher",
      email: "community@e2e.test",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db
    .insert(mcpServer)
    .values({
      id: "e2emcpserver_comm_0000000001",
      userId: COMM_USER_ID,
      name: "Community Weather MCP",
      url: "http://127.0.0.1:4000/mcp",
      headers: JSON.stringify({}),
      enabled: true,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  // 8. Ensure Storage & Vector Collections
  try {
    await ensureBucket();
  } catch (err) {
    console.warn("⚠️ MinIO bucket check skipped or failed:", err);
  }

  try {
    await ensureQdrantCollection(1024);
  } catch (err) {
    console.warn("⚠️ Qdrant collection check skipped or failed:", err);
  }

  console.log("✅ E2E seed completed successfully.");
}

// Standalone execution support
if (process.argv[1]?.endsWith("seed-e2e.ts")) {
  seedE2eDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ E2E seed failed:", err);
      process.exit(1);
    });
}
