import { z } from "zod";
import {
  nameField,
  descriptionField,
  contentField,
  renameSchema,
  idField,
} from "../shared-fields";

/**
 * Validates new project creation data for organizing chats with shared system prompts.
 * Name required (1-100 chars); description optional (max 500 chars).
 * globalPrompt optional (max 10,000 chars) to prepend to all chats in this project.
 * Tools array specifies MCP tools available to all chats in the project.
 * knowledgebaseId optionally binds all chats to a shared knowledge base for RAG context.
 * Use with createProject server action to create a new chat grouping and prompt scope.
 *
 * @see {@link lib/actions/projects/create-project.ts} for creation action
 * @see {@link types/project/project.ts} for database representation
 * @author Maruf Bepary
 */
export const createProjectSchema = z.object({
  name: nameField,
  description: descriptionField,
  globalPrompt: contentField.optional(),
  tools: z.array(z.string()).optional(),
  knowledgebaseId: z.string().nullable().optional(),
});

/**
 * Validates partial project updates allowing selective field modification.
 * All fields optional to enable independent updates of name, description, prompt, tools, or knowledgebase.
 * Omitted fields preserve existing values.
 * Use with updateProject server action to modify existing project metadata and prompts.
 *
 * @see {@link lib/actions/projects/update-project.ts} for update action
 * @author Maruf Bepary
 */
export const updateProjectSchema = createProjectSchema.partial();

/**
 * Validates project rename operations with only the new name field.
 * Requires name to be non-empty and under 100 characters.
 * Quick name changes without modifying description, prompt, or tools.
 * Use with renameProject server action for efficient name updates.
 *
 * @see {@link lib/actions/projects/rename-project.ts} for rename action
 * @see {@link schemas/shared-fields.ts} for renameSchema definition
 * @author Maruf Bepary
 */
export const renameProjectSchema = renameSchema;

/**
 * Validates the full project object as stored in the database and loaded in the store.
 * Includes all fields from creation plus system metadata (id, userId, isPinned, timestamps).
 * isPinned flag controls whether project appears in pinned section of sidebar.
 * Tools and knowledgebaseId are inherited by all chats in the project.
 * Use for type-safe store hydration and API serialization.
 *
 * @author Maruf Bepary
 */
export const projectSchema = z.object({
  id: idField,
  userId: z.string(),
  name: nameField,
  description: descriptionField,
  isPinned: z.boolean(),
  globalPrompt: z.string(),
  tools: z.array(z.string()),
  knowledgebaseId: idField.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
