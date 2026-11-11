import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/config/env";
import * as aiModelSchema from "@/drizzle/schemas/ai-model-schema";
import * as aiProviderSchema from "@/drizzle/schemas/ai-provider-schema";
import * as assistantSchema from "@/drizzle/schemas/assistant-schema";
import * as authSchema from "@/drizzle/schemas/auth-schema";
import * as chatSchema from "@/drizzle/schemas/chat-schema";
import * as kbDocumentRelationSchema from "@/drizzle/schemas/kb-document-relation-schema";
import * as kbDocumentSchema from "@/drizzle/schemas/kb-document-schema";
import * as knowledgebaseSchema from "@/drizzle/schemas/knowledgebase-schema";
import * as mcpServerSchema from "@/drizzle/schemas/mcp-server-schema";
import * as projectSchema from "@/drizzle/schemas/project-schema";
import * as promptSchema from "@/drizzle/schemas/prompt-schema";
import * as skillSchema from "@/drizzle/schemas/skill-schema";
import * as subagentSchema from "@/drizzle/schemas/subagent-schema";
import * as transformAgentSchema from "@/drizzle/schemas/transform-agent-schema";
import * as userMemorySchema from "@/drizzle/schemas/user-memory-schema";
import * as userSettingsSchema from "@/drizzle/schemas/user-settings-schema";
import * as workflowSchema from "@/drizzle/schemas/workflow-schema";

const schema = {
  ...aiModelSchema,
  ...aiProviderSchema,
  ...assistantSchema,
  ...authSchema,
  ...chatSchema,
  ...kbDocumentSchema,
  ...kbDocumentRelationSchema,
  ...knowledgebaseSchema,
  ...mcpServerSchema,
  ...projectSchema,
  ...promptSchema,
  ...skillSchema,
  ...subagentSchema,
  ...transformAgentSchema,
  ...userMemorySchema,
  ...userSettingsSchema,
  ...workflowSchema,
};

/**
 * Normalizes PostgreSQL connection string for pg-connection-string libpq compatibility.
 * When sslmode is require, prefer, or verify-ca and uselibpqcompat is not specified, adds uselibpqcompat=true
 * to eliminate Node.js security deprecation warnings in serverless environments.
 *
 * @param rawUrl - Database connection string
 * @returns Normalized connection string
 * @author Maruf Bepary
 */
export function normalizePostgresUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const sslmode = parsed.searchParams.get("sslmode");
    if (
      (sslmode === "require" ||
        sslmode === "prefer" ||
        sslmode === "verify-ca") &&
      !parsed.searchParams.has("uselibpqcompat")
    ) {
      parsed.searchParams.set("uselibpqcompat", "true");
      return parsed.toString();
    }
  } catch {
    // Return original string if not a parseable URL
  }
  return rawUrl;
}

/**
 * Drizzle ORM database client configured with full application schema.
 * Uses node-postgres driver and DATABASE_URL environment variable for connection string.
 * Must be initialised before any Server Action or API route uses database queries.
 * Schema includes auth tables (user, session, account, verification, twoFactor, passkey) and app tables (chat, message, attachment, project, assistant, prompt, mcpServer).
 */
export const db = drizzle(normalizePostgresUrl(env.DATABASE_URL), { schema });
