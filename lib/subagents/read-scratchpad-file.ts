import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { subagentScratchpad } from "@/drizzle/schemas/subagent-schema";
import { normaliseScratchpadPath } from "@/lib/subagents/normalise-scratchpad-path";

interface ScratchpadEntry {
  id: string;
  filePath: string;
  content: string;
  writtenByRole: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Reads a single file from the scratchpad for a given message turn.
 *
 * @author Maruf Bepary
 */
export async function readScratchpadFile(
  messageId: string,
  rawPath: string,
): Promise<ScratchpadEntry | null> {
  const filePath = normaliseScratchpadPath(rawPath);

  const [row] = await db
    .select({
      id: subagentScratchpad.id,
      filePath: subagentScratchpad.filePath,
      content: subagentScratchpad.content,
      writtenByRole: subagentScratchpad.writtenByRole,
      version: subagentScratchpad.version,
      createdAt: subagentScratchpad.createdAt,
      updatedAt: subagentScratchpad.updatedAt,
    })
    .from(subagentScratchpad)
    .where(
      and(
        eq(subagentScratchpad.messageId, messageId),
        eq(subagentScratchpad.filePath, filePath),
      ),
    )
    .limit(1);

  return row ?? null;
}
