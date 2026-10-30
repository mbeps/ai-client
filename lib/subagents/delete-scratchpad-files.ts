import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { subagentScratchpad } from "@/drizzle/schemas/subagent-schema";
import { getLogger } from "@/lib/logger";

const log = getLogger(["subagents", "scratchpad"]);

/**
 * Deletes all scratchpad files recorded for an assistant message turn.
 * Used to clean up orphaned scratchpad rows when a turn is aborted or fails before the message row is persisted.
 *
 * @param messageId - Target message id
 * @returns The resolved result
 * @author Maruf Bepary
 */
export async function deleteScratchpadFiles(messageId: string): Promise<void> {
  try {
    await db
      .delete(subagentScratchpad)
      .where(eq(subagentScratchpad.messageId, messageId));
  } catch (error) {
    log.error("Failed to delete scratchpad files (messageId: {messageId})", {
      messageId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
