import { z } from "zod";

/**
 * Validates a message object for persistence.
 *
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
 * Validates chat creation data.
 */
export const createChatSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  projectId: z.string().uuid().nullable().optional(),
  assistantId: z.string().uuid().nullable().optional(),
});

/**
 * Validates chat rename data.
 */
export const renameChatSchema = z.object({
  title: z.string().min(1).max(255),
});

/**
 * Validates chat move data.
 */
export const moveChatSchema = z.object({
  projectId: z.string().uuid().nullable(),
});

/**
 * Validates message metadata (tool calls, tool results, reasoning).
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
