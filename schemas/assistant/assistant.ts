import { z } from "zod";
import {
  nameField,
  descriptionField,
  contentField,
  renameSchema,
} from "../shared-fields";

/**
 * Validates new assistant creation data with name, description, system prompt, and optional avatar URL.
 * Name required (1-100 chars); description optional (max 500 chars).
 * Prompt capped at 10,000 chars to maintain reasonable token usage in AI requests.
 * Avatar must be valid URL if provided (max 1024 chars).
 * Tools array specifies which MCP tools are available for this assistant.
 * Use with createAssistant server action to persist new AI personas for chat sessions.
 * Assistants enable creation of reusable chat personalities with consistent system instructions.
 *
 * @see {@link lib/actions/assistants/create-assistant.ts} for creation action
 * @see {@link types/assistant/assistant.ts} for database representation
 * @see {@link schemas/assistant/assistant.ts} for full assistant schema
 * @author Maruf Bepary
 */
export const createAssistantSchema = z.object({
  name: nameField,
  description: descriptionField,
  prompt: contentField.optional(),
  tools: z.array(z.string()).optional(),
  avatar: z.string().url().max(1024).optional().nullable(),
});

/**
 * Validates partial assistant updates allowing selective field modification.
 * All fields optional to enable independent updates of name, description, prompt, tools, or avatar.
 * Omitted fields preserve existing values; set fields to null where applicable to clear them.
 * Use with updateAssistant server action to modify existing assistant configurations.
 * Supports granular updates via PATCH-style semantics (not full replacement).
 *
 * @see {@link lib/actions/assistants/update-assistant.ts} for update action
 * @author Maruf Bepary
 */
export const updateAssistantSchema = createAssistantSchema.partial();

/**
 * Validates assistant rename operations with only the new name field.
 * Requires name to be non-empty (1-100 chars).
 * Quick name changes without modifying description, prompt, or tools.
 * Use with renameAssistant server action for efficient name updates.
 *
 * @see {@link lib/actions/assistants/rename-assistant.ts} for rename action
 * @see {@link schemas/shared-fields.ts} for renameSchema definition
 * @author Maruf Bepary
 */
export const renameAssistantSchema = renameSchema;

/**
 * Validates the full assistant object as stored in the database and loaded from the store.
 * Includes all fields from creation plus system metadata (id, userId, timestamps).
 * Avatar nullable to support assistants without custom avatars.
 * Use for type-safe store hydration and API serialization.
 *
 * @author Maruf Bepary
 */
export const assistantSchema = z.object({
  id: z.string().uuid(),
  userId: z.string(),
  name: nameField,
  description: z.string(),
  prompt: z.string(),
  tools: z.array(z.string()),
  avatar: z.string().url().max(1024).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
