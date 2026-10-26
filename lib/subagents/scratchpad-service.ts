import { sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { subagentScratchpad } from "@/drizzle/schema";
import { getLogger } from "@/lib/logger";
import { normaliseScratchpadPath } from "./normalise-scratchpad-path";

const log = getLogger(["subagents", "scratchpad"]);

interface UpsertScratchpadParams {
  chatId: string;
  messageId: string;
  filePath: string;
  content: string;
  writtenByRole: string;
}

/**
 * Inserts or updates an intermediate file in the subagent scratchpad atomically.
 * Automatically increments version if the file already exists for this message.
 *
 * @author Maruf Bepary
 */
export async function upsertScratchpadFile(
  params: UpsertScratchpadParams,
): Promise<{ id: string; filePath: string; version: number }> {
  const filePath = normaliseScratchpadPath(params.filePath);

  const [row] = await db
    .insert(subagentScratchpad)
    .values({
      chatId: params.chatId,
      messageId: params.messageId,
      filePath,
      content: params.content,
      writtenByRole: params.writtenByRole,
      version: 1,
    })
    .onConflictDoUpdate({
      target: [subagentScratchpad.messageId, subagentScratchpad.filePath],
      set: {
        content: params.content,
        writtenByRole: params.writtenByRole,
        version: sql`${subagentScratchpad.version} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({
      id: subagentScratchpad.id,
      filePath: subagentScratchpad.filePath,
      version: subagentScratchpad.version,
    });

  log.debug(
    "Upserted scratchpad file (messageId: {msgId}, path: {path}, v: {v})",
    {
      msgId: params.messageId,
      path: filePath,
      v: row.version,
    },
  );

  return row;
}
