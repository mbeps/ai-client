import { z } from "zod";
import { PROMPTS } from "@/constants/prompts";
import { idField } from "../shared-fields";

/**
 * Validates a message object for persistence to the database.
 * Enforces UUID format for id and parentId, ensures content is non-empty, and validates role enumeration.
 * Use when saving individual messages in a chat conversation tree structure.
 *
 * @see {@link lib/actions/chats/} for message persistence actions
 * @author Maruf Bepary
 */
export const persistMessageSchema = z.object({
  id: idField,
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  parentId: idField.nullable(),
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
  projectId: idField.nullable().optional(),
  assistantId: idField.nullable().optional(),
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
  projectId: idField.nullable(),
});

/**
 * Validates the full chat object for the store.
 */
export const chatSchema = z.object({
  id: idField,
  title: z.string(),
  projectId: idField.nullable().optional(),
  assistantId: idField.nullable().optional(),
  knowledgebaseId: idField.nullable().optional(),
  projectName: z.string().optional(),
  assistantName: z.string().optional(),
  updatedAt: z.date(),
  currentLeafId: idField.nullable(),
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
 * Validates a message object sent in a chat request.
 * Supports complex content parts and optional file attachments.
 */
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.union([
    z.string(),
    z.array(
      z.union([
        z.object({ type: z.literal("text"), text: z.string() }),
        z.object({
          type: z.literal("image"),
          image: z.union([z.string().url(), z.string()]),
          mimeType: z.string().optional(),
        }),
      ]),
    ),
  ]),
  id: idField.optional(),
  parentId: idField.optional(),
  attachments: z
    .array(
      z.object({
        id: idField,
        name: z.string().min(1).max(255),
        mimeType: z.string().max(100).optional(),
        type: z.enum(["image", "document", "spreadsheet"]).optional(),
        dataUrl: z.string().optional(),
        extractedText: z.string().optional(),
        key: z.string().max(1024).optional(),
      }),
    )
    .optional(),
  metadata: z.string().nullable().optional(),
});

/**
 * Validates the full POST request body for the chat API endpoint.
 * Includes chatId, message history, model selection, and MCP tool/resource selections.
 */
export const chatRequestSchema = z.object({
  chatId: idField,
  userMessageId: idField.optional(),
  model: z.string().max(100).optional(),
  messages: z.array(chatMessageSchema).max(500),
  selectedServerIds: z.array(z.string()).max(20).optional(),
  selectedTools: z.array(z.string()).max(100).optional(),
  selectedAssistantId: idField.optional(),
  selectedKbIds: z.array(idField).max(5).optional(),
});

/**
 * Base fields for manage_artifact tool to avoid code duplication in the union schema.
 */
const manageArtifactBaseFields = {
  type: z.string().describe(PROMPTS.SCHEMA.MANAGE_ARTIFACT.TYPE_DESCRIPTION),
  title: z
    .string()
    .optional()
    .describe(PROMPTS.SCHEMA.MANAGE_ARTIFACT.TITLE_DESCRIPTION),
  content: z
    .string()
    .optional()
    .describe(
      "The content of the artifact. " +
        "For spreadsheet type, you may EITHER pass a JSON string in this field OR pass a top-level 'sheets' argument. " +
        'Format: { "sheets": [{ "name": "Sheet1", "data": [["A1", "B1"], ["A2", "B2"]] }] }. ' +
        'Values in data can be simple types or objects { "v": value, "s": { "bold": true, "italic": true, "textAlign": "center", "backgroundColor": "#...", "color": "#..." } }. ' +
        "For HTML, provide raw HTML. For markdown, provide markdown text. For mermaid, provide diagram code.",
    ),
  sheets: z
    .array(
      z.object({
        name: z.string(),
        data: z.array(z.array(z.unknown())),
        columns: z
          .array(z.object({ header: z.string(), width: z.number().optional() }))
          .optional(),
      }),
    )
    .optional()
    .describe(
      "Alternative to content for spreadsheet type. Pass sheets directly as a structured array instead of a JSON string.",
    ),
};

/**
 * Validates parameters for the internal manage_artifact tool.
 * Accepts both flat and nested 'artifact' key structures to support various AI models.
 * Normalizes to flat structure via transform.
 */
export const manageArtifactSchema = z.union([
  z.object(manageArtifactBaseFields),
  z
    .object({
      artifact: z.object(manageArtifactBaseFields),
    })
    .transform((val) => val.artifact),
  // Some models pass the entire artifact spec as a JSON string; parse and validate it.
  z
    .string()
    .transform((str) => {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    })
    .pipe(z.object(manageArtifactBaseFields)),
]);

export const searchKnowledgeBaseSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      "Search query to find relevant information in the knowledge base. Be specific and focused.",
    ),
});
