import { z } from "zod";
import { PROMPTS } from "@/constants/prompts";

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

/**
 * Validates a file attachment in a chat request.
 * Supports images, documents, and spreadsheets with metadata like mimeType and extraction results.
 */
export const chatAttachmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  mimeType: z.string().max(100).optional(),
  type: z.enum(["image", "document", "spreadsheet"]).optional(),
  dataUrl: z.string().optional(),
  extractedText: z.string().optional(),
  key: z.string().max(1024).optional(),
});

/**
 * Validates a single content part of a message (text or image).
 * Used in multimodal message history for the AI provider.
 */
export const chatContentPartSchema = z.union([
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({
    type: z.literal("image"),
    image: z.union([z.string().url(), z.string()]),
    mimeType: z.string().optional(),
  }),
]);

/**
 * Validates a message object sent in a chat request.
 * Supports complex content parts and optional file attachments.
 */
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.union([z.string(), z.array(chatContentPartSchema)]),
  id: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  attachments: z.array(chatAttachmentSchema).optional(),
  metadata: z.string().nullable().optional(),
});

/**
 * Validates the full POST request body for the chat API endpoint.
 * Includes chatId, message history, model selection, and MCP tool/resource selections.
 */
export const chatRequestSchema = z.object({
  chatId: z.string().uuid(),
  userMessageId: z.string().uuid().optional(),
  model: z.string().min(1).max(100).optional(),
  messages: z.array(chatMessageSchema).max(500),
  selectedServerIds: z.array(z.string()).max(20).optional(),
  selectedTools: z.array(z.string()).max(100).optional(),
  selectedAssistantId: z.string().uuid().optional(),
});

/**
 * Validates parameters for the internal manage_artifact tool.
 * Ensures the AI provides a valid type, title, and content for the artifact panel.
 */
export const manageArtifactSchema = z.object({
  type: z.string().describe(PROMPTS.SCHEMA.MANAGE_ARTIFACT.TYPE_DESCRIPTION),
  title: z
    .string()
    .optional()
    .describe(PROMPTS.SCHEMA.MANAGE_ARTIFACT.TITLE_DESCRIPTION),
  content: z
    .string()
    .describe(PROMPTS.SCHEMA.MANAGE_ARTIFACT.CONTENT_DESCRIPTION),
});
