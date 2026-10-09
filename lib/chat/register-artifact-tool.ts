import { tool } from "ai";
import { PROMPTS } from "@/config/prompts";
import { getLogger } from "@/lib/logger";
import { manageArtifactSchema } from "@/schemas/chat/chat";

const log = getLogger(["app", "chat", "tools"]);

/**
 * Registers the internal manage_artifact tool for interactive artifacts.
 *
 * @returns Object with manage_artifact tool definition
 * @author Maruf Bepary
 */
export function registerArtifactTool() {
  return {
    manage_artifact: tool({
      description: PROMPTS.TOOLS.MANAGE_ARTIFACT.DESCRIPTION,
      inputSchema: manageArtifactSchema,
      execute: async (args) => {
        try {
          // For spreadsheets the AI may pass `sheets` as a top-level arg instead of
          // embedding the JSON in `content`. Serialize it so the viewer can parse it.
          // ponytail: `text` is not in the advertised schema but some models still send it.
          let content = args.content || (args as { text?: string }).text || "";

          // If sheets are provided directly, use them to build the content
          if (args.sheets && Array.isArray(args.sheets)) {
            content = JSON.stringify({ sheets: args.sheets });
          } else if (args.sheets && typeof args.sheets === "string") {
            // Some models might stringify the sheets array themselves
            try {
              const parsedSheets = JSON.parse(args.sheets);
              if (Array.isArray(parsedSheets)) {
                content = JSON.stringify({ sheets: parsedSheets });
              } else if (parsedSheets.sheets) {
                content = JSON.stringify(parsedSheets);
              }
            } catch {
              // Fallback to raw string if it's not valid JSON
              content = args.sheets;
            }
          }

          const normalizedArgs = {
            id: crypto.randomUUID(),
            // Schema validates type at parse time, so args.type is always valid here.
            type: args.type,
            title: args.title || PROMPTS.TOOLS.MANAGE_ARTIFACT.DEFAULT_TITLE,
            content,
          };

          return {
            success: true,
            message: PROMPTS.TOOLS.MANAGE_ARTIFACT.SUCCESS_MESSAGE,
            artifact: normalizedArgs,
          };
        } catch (error) {
          log.error("Failed to process artifact tool call: {error}", {
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            message:
              error instanceof Error ? error.message : "Unknown error occurred",
          };
        }
      },
      toModelOutput: ({ output }: { output: any }) => {
        const title = output?.artifact?.title || "Artifact";
        const type = output?.artifact?.type || "document";
        const success = output?.success ?? true;
        return {
          type: "text",
          value: success
            ? `Artifact "${title}" (${type}) created successfully and presented to the user on canvas.`
            : `Failed to create artifact: ${output?.message || "Unknown error"}`,
        };
      },
    }),
  };
}
