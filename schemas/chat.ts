import { z } from "zod";

/**
 * Validates a message object for persistence to the database.
 * Enforces UUID format for id and parentId, ensures content is non-empty, and validates role enumeration.
 * Use when saving individual messages in a chat conversation tree structure.
 *
 * @see {@link lib/actions/chats/} for message persistence actions
 * @author Maruf Bepary
 */
export const persistMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  parentId: z.string().uuid().nullable(),
  metadata: z.string().nullable().optional(),
});

/**
 * Validates chat creation data from form input or API calls.
 * Title is optional (1-255 chars); projectId and assistantId are optional UUIDs for binding chats to projects or assistants.
 * Use when creating a new conversation thread via createChat server action.
 *
 * @see {@link lib/actions/chats/create-chat.ts} for chat creation action
 * @author Maruf Bepary
 */
export const createChatSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  projectId: z.string().uuid().nullable().optional(),
  assistantId: z.string().uuid().nullable().optional(),
});

/**
 * Validates chat title updates during rename operations.
 * Requires title to be non-empty and under 255 characters.
 * Use when renaming an existing chat conversation.
 *
 * @see {@link lib/actions/chats/rename-chat.ts} for rename action
 * @author Maruf Bepary
 */
export const renameChatSchema = z.object({
  title: z.string().min(1).max(255),
});

/**
 * Validates chat project reassignment data when moving a chat between projects.
 * Accepts a valid UUID for projectId or null to remove project binding.
 * Use when reassigning a chat to a different project or unbinding it.
 *
 * @see {@link lib/actions/chats/move-chat.ts} for move action
 * @author Maruf Bepary
 */
export const moveChatSchema = z.object({
  projectId: z.string().uuid().nullable(),
});

/**
 * Validates message metadata capturing AI reasoning, tool invocations, and results.
 * Stores optional tool calls array (with ids, names, args), tool results array, reasoning text, and model identifier.
 * Use when persisting extended message context with tool execution traces and AI thinking process.
 *
 * @see {@link lib/actions/chats/} for message persistence with metadata
 * @author Maruf Bepary
 */
export const messageMetadataSchema = z.object({
  toolCalls: z
    .array(
      z.object({
        toolCallId: z.string(),
        toolName: z.string(),
        args: z.unknown(),
      }),
    )
    .optional(),
  toolResults: z
    .array(
      z.object({
        toolCallId: z.string(),
        toolName: z.string(),
        result: z.unknown(),
      }),
    )
    .optional(),
  reasoning: z.string().optional(),
  model: z.string().optional(),
});
