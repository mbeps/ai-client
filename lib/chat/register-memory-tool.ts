import { tool } from "ai";
import { PROMPTS } from "@/config/prompts";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { saveMemoryForUser } from "@/lib/memory/memory-service";
import { saveMemoryToolSchema } from "@/schemas/memory/memory";

/**
 * Registers the internal save_memory tool for persisting user preferences and facts.
 *
 * @param userId - ID of the authenticated user
 * @param selectedTools - Optional list of tool IDs selected for this chat
 * @returns Object with save_memory tool if eligible, empty object otherwise
 * @author Maruf Bepary
 */
export function registerMemoryTool(
  userId: string,
  selectedTools?: string[],
): Record<string, any> {
  const isGated =
    selectedTools === undefined ||
    selectedTools.includes(INTERNAL_TOOL_IDS.MANAGE_MEMORY) ||
    selectedTools.includes("save_memory");

  if (!isGated) {
    return {};
  }

  return {
    save_memory: tool({
      description: PROMPTS.TOOLS.SAVE_MEMORY.DESCRIPTION,
      inputSchema: saveMemoryToolSchema,
      execute: async (args) => {
        const content = (args.content || "").trim();
        if (!content) {
          return {
            success: false,
            error: "Memory content cannot be empty.",
          };
        }

        try {
          const memory = await saveMemoryForUser(userId, content);
          return {
            success: true,
            message: `Memory saved: "${memory.content}".`,
            memoryId: memory.id,
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error ? error.message : "Failed to save memory.",
          };
        }
      },
    }),
  };
}
