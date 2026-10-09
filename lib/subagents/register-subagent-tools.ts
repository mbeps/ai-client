import { tool } from "ai";
import { z } from "zod";
import { getLogger } from "@/lib/logger";
import {
  listScratchpadFiles,
  readScratchpadFile,
  upsertScratchpadFile,
} from "./scratchpad-service";

const log = getLogger(["subagents", "tools"]);

export interface ScratchpadToolContext {
  chatId: string;
  messageId: string;
  workerRole: string;
}

/**
 * Registers internal scratchpad tools that allow subagents and the orchestrator
 * to read, write, and list shared files during a turn.
 *
 * @author Maruf Bepary
 */
export function registerScratchpadTools(context: ScratchpadToolContext) {
  const { chatId, messageId, workerRole } = context;

  return {
    scratchpad_write: tool({
      description:
        "Writes or updates an intermediate file in the shared scratchpad. " +
        "Use this to persist structured data, findings, outlines, or draft code for review, " +
        "peer cross-referencing, or user inspection without bloating conversational context. " +
        "DO NOT use this for trivial chat responses.",
      inputSchema: z.object({
        filePath: z
          .string()
          .describe(
            "Relative file path (e.g., 'notes/findings.md', 'specs/plan.json').",
          ),
        content: z
          .string()
          .max(2_000_000, "Content cannot exceed 2MB")
          .describe("Text or JSON content to store."),
      }),
      execute: async ({ filePath, content }) => {
        try {
          const result = await upsertScratchpadFile({
            chatId,
            messageId,
            filePath,
            content,
            writtenByRole: workerRole,
          });

          return {
            success: true,
            filePath: result.filePath,
            version: result.version,
            message: `Successfully saved "${result.filePath}" (v${result.version}).`,
          };
        } catch (error) {
          log.error("Failed to write to scratchpad: {error}", {
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to write scratchpad file",
          };
        }
      },
    }),

    scratchpad_read: tool({
      description:
        "Reads a file from the shared scratchpad for this conversation turn. " +
        "Use this to access notes, specifications, or outputs written by earlier steps or peer subagents.",
      inputSchema: z.object({
        filePath: z.string().describe("Path of the file to read."),
        startLine: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Optional 1-indexed starting line to read from."),
        lineCount: z
          .number()
          .int()
          .min(1)
          .max(500)
          .optional()
          .describe("Optional maximum number of lines to read."),
      }),
      execute: async ({ filePath, startLine, lineCount }) => {
        try {
          const file = await readScratchpadFile(messageId, filePath);
          if (!file) {
            return {
              success: false,
              error: `File "${filePath}" not found in scratchpad.`,
            };
          }

          let content = file.content;
          const allLines = content.split("\n");
          const totalLines = allLines.length;

          if (startLine !== undefined) {
            const startIdx = Math.max(0, startLine - 1);
            const count = lineCount ?? 200;
            const slice = allLines.slice(startIdx, startIdx + count);
            content = slice.join("\n");
          } else if (content.length > 15000) {
            // Guardrail against massive context dumps without pagination
            content =
              content.slice(0, 15000) +
              `\n\n[... File truncated at 15,000 characters. Total lines: ${totalLines}. Specify startLine and lineCount to read specific sections.]`;
          }

          return {
            success: true,
            filePath: file.filePath,
            content,
            totalLines,
            writtenByRole: file.writtenByRole,
            version: file.version,
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to read scratchpad file",
          };
        }
      },
    }),

    scratchpad_list: tool({
      description:
        "Lists all intermediate files currently stored in the shared scratchpad for this turn.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          const files = await listScratchpadFiles(messageId);
          return {
            success: true,
            files: files.map((f) => ({
              filePath: f.filePath,
              writtenByRole: f.writtenByRole,
              version: f.version,
              sizeBytes: f.sizeBytes,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Failed to list scratchpad files",
          };
        }
      },
    }),
  };
}
