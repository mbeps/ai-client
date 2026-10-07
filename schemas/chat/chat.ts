import { z } from "zod";
import { PROMPTS } from "@/config/prompts";
import { dateField, idField } from "@/schemas/shared-fields";

/**
 * Validates a message object for persistence to the database.
 * Enforces UUID format for id and parentId, ensures content is non-empty.
 * Role enumeration constrains to valid message types (user, assistant, system).
 * Metadata stores JSON-serialized tool calls and extended-thinking tokens.
 * Use when saving individual messages in a chat conversation tree structure.
 *
 * @see {@link lib/actions/chats/}} for message persistence actions
 * @see {@link types/message/message.ts} for Message type
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
 * Title optional (1-255 chars); projectId and assistantId optional UUIDs for binding chats to resources.
 * Null values allow chats without project or assistant association (standalone chats).
 * Use when creating a new conversation thread via createChat server action.
 * Enables flexible chat organization via optional project/assistant scoping.
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
 * Requires title to be non-empty (1-255 chars).
 * Single-field schema for efficient rename requests.
 * Use when renaming an existing chat conversation via renameChat server action.
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
 * Allows "unbinding" chats from projects (standalone mode) when null is provided.
 * Use when reassigning a chat to a different project or unbinding it via moveChatserver action.
 *
 * @see {@link lib/actions/chats/move-chat.ts} for move action
 * @author Maruf Bepary
 */
export const moveChatSchema = z.object({
  projectId: idField.nullable(),
});

/**
 * Validates the full chat object for the store.
 * Includes metadata for navigation and display (projectName, assistantName).
 * currentLeafId tracks the active message in the tree for branching conversations.
 * All fields required for complete chat state representation in Zustand store.
 *
 * @author Maruf Bepary
 */
export const chatSchema = z.object({
  id: idField,
  title: z.string(),
  projectId: idField.nullable().optional(),
  assistantId: idField.nullable().optional(),
  knowledgebaseId: idField.nullable().optional(),
  projectName: z.string().optional(),
  assistantName: z.string().optional(),
  createdAt: dateField.optional(),
  updatedAt: z.date(),
  currentLeafId: idField.nullable(),
});

/**
 * Validates message metadata capturing AI reasoning, tool invocations, and results.
 * Stores optional tool calls array (with ids, names, args), tool results array.
 * Reasoning text from extended-thinking models; model identifier for audit/versioning.
 * All fields optional since not all messages have tools or reasoning.
 * Use when persisting extended message context with tool execution traces and AI thinking.
 *
 * @see {@link lib/actions/chats/}} for message persistence with metadata
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
 * Validates the POST request body for the chat API endpoint.
 * The client sends only identifiers — the full message thread is loaded
 * server-side from the database (loadThreadFromDb), so no `messages` array
 * is accepted. Strict object: unknown fields (including legacy `messages`)
 * fail validation.
 */
export const chatRequestSchema = z
  .object({
    chatId: idField,
    userMessageId: idField,
    model: z.string().max(100).optional(),
    selectedServerIds: z.array(z.string()).max(20).optional(),
    selectedTools: z.array(z.string()).max(100).optional(),
    selectedAssistantId: idField.optional(),
    selectedPromptId: idField.optional(),
    selectedPromptIds: z.array(z.string()).max(10).optional(),
    selectedSkillIds: z.array(z.string()).max(20).optional(),
    selectedKbIds: z.array(idField).max(5).optional(),
  })
  .strict();

/**
 * Base fields for manage_artifact tool to avoid code duplication in the union schema.
 */
const manageArtifactBaseFields = {
  type: z
    .enum(["markdown", "spreadsheet", "html", "mermaid"])
    .describe(PROMPTS.SCHEMA.MANAGE_ARTIFACT.TYPE_DESCRIPTION),
  id: z.string().optional().describe("Unique identifier for the artifact."),
  title: z
    .string()
    .optional()
    .describe(PROMPTS.SCHEMA.MANAGE_ARTIFACT.TITLE_DESCRIPTION),
  content: z
    .string()
    .optional()
    .describe(PROMPTS.SCHEMA.MANAGE_ARTIFACT.CONTENT_DESCRIPTION),
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
 * Normalises input for manage_artifact tool.
 * Tolerates JSON strings and nested { artifact: ... } wrappers from various AI models,
 * allowing the advertised JSON Schema to remain a clean, single-object schema.
 */
function normaliseManageArtifactInput(val: unknown): unknown {
  let target = val;
  if (typeof target === "string") {
    try {
      target = JSON.parse(target);
    } catch {
      return val;
    }
  }
  if (
    typeof target === "object" &&
    target !== null &&
    !Array.isArray(target) &&
    "artifact" in target &&
    typeof (target as { artifact?: unknown }).artifact === "object" &&
    (target as { artifact?: unknown }).artifact !== null
  ) {
    return (target as { artifact: unknown }).artifact;
  }
  return target;
}

export const manageArtifactBaseSchema = z.object(manageArtifactBaseFields);

/**
 * Validates parameters for the internal manage_artifact tool.
 * Uses preprocess to tolerate JSON strings and nested 'artifact' wrappers,
 * while advertising a clean single-object schema to AI models without anyOf.
 */
export const manageArtifactSchema = Object.assign(
  z.preprocess(normaliseManageArtifactInput, manageArtifactBaseSchema),
  { shape: manageArtifactBaseSchema.shape },
);

const searchKnowledgeBaseBaseSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .describe(
      "Search query to find relevant information in the knowledge base. Be specific and focused.",
    ),
});

/**
 * Normalises input for search_knowledge_base tool.
 * Tolerates JSON strings and nested { search_knowledge_base: ... } wrappers,
 * allowing the advertised JSON Schema to remain a clean, single-object schema.
 */
function normaliseSearchKnowledgeBaseInput(val: unknown): unknown {
  let target = val;
  if (typeof target === "string") {
    try {
      target = JSON.parse(target);
    } catch {
      return val;
    }
  }
  if (
    typeof target === "object" &&
    target !== null &&
    !Array.isArray(target) &&
    "search_knowledge_base" in target &&
    typeof (target as { search_knowledge_base?: unknown })
      .search_knowledge_base === "object" &&
    (target as { search_knowledge_base?: unknown }).search_knowledge_base !==
      null
  ) {
    return (target as { search_knowledge_base: unknown }).search_knowledge_base;
  }
  return target;
}

/**
 * Validates parameters for the internal search_knowledge_base tool.
 * Uses preprocess to tolerate JSON strings and nested wrappers,
 * advertising a clean single-object schema to AI models without anyOf.
 */
export const searchKnowledgeBaseSchema = Object.assign(
  z.preprocess(
    normaliseSearchKnowledgeBaseInput,
    searchKnowledgeBaseBaseSchema,
  ),
  { shape: searchKnowledgeBaseBaseSchema.shape },
);

/**
 * Validates chat knowledge base update requests.
 * Accepts a valid UUID for chatId and a valid UUID (or null) for knowledgebaseId.
 * Null value allows disabling RAG context for the chat.
 * Use when associating or disassociating a knowledge base with a chat via updateChatKnowledgebase action.
 *
 * @see {@link lib/actions/chats/update-chat-knowledgebase.ts} for update action
 * @author Maruf Bepary
 */
export const updateChatKnowledgebaseSchema = z.object({
  chatId: idField,
  knowledgebaseId: idField.nullable(),
});

/**
 * Validates the DELETE /api/chat/stop request body.
 * Only requires chatId to identify which chat's generation to cancel.
 *
 * @author Maruf Bepary
 */
export const stopChatRequestSchema = z.object({ chatId: idField }).strict();
