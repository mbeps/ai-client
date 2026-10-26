import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "@/config/env";
import * as aiModelSchema from "@/drizzle/schemas/ai-model-schema";
import * as aiProviderSchema from "@/drizzle/schemas/ai-provider-schema";
import * as assistantSchema from "@/drizzle/schemas/assistant-schema";
import * as authSchema from "@/drizzle/schemas/auth-schema";
import * as chatSchema from "@/drizzle/schemas/chat-schema";
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
 * Drizzle ORM database client configured with full application schema.
 * Uses node-postgres driver and DATABASE_URL environment variable for connection string.
 * Must be initialised before any Server Action or API route uses database queries.
 * Schema includes auth tables (user, session, account, verification, twoFactor, passkey) and app tables (chat, message, attachment, project, assistant, prompt, mcpServer).
 */
export const db = drizzle(env.DATABASE_URL, { schema });
