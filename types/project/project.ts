import { z } from "zod";
import { projectSchema } from "@/schemas/project/project";

/**
 * Represents a workspace that groups related chats with shared system prompts and knowledge bases.
 * Projects organize conversations by context (team, domain, task type, or client).
 * All chats within a project inherit the global system prompt prepended before assistant-specific prompts.
 * Knowledge bases bound to a project provide RAG context for all contained chats.
 * Derived from Zod schema for validation and type safety.
 *
 * @see {@link schemas/project/project.ts} for creation/update validation
 * @see {@link types/project/project-row.ts} for database representation
 * @see {@link types/chat/chat-row.ts} for chats grouped under this project
 * @author Maruf Bepary
 */
export type Project = z.infer<typeof projectSchema>;
