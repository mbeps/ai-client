import { z } from "zod";
import { projectSchema } from "@/schemas/project/project";

/**
 * Represents a workspace that groups related chats with shared system prompts and knowledge bases.
 * Projects organize conversations by context (e.g., project type, domain, or team).
 * All chats within a project inherit the global system prompt, which is prepended
 * before assistant-specific prompts during AI requests.
 *
 * @see Chat for chats grouped under this project
 * @see Assistant for individual AI personas (distinct from project-level prompts)
 */
export type Project = z.infer<typeof projectSchema>;
