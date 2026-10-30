import { eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { subagentScratchpad } from "@/drizzle/schemas/subagent-schema";

/**
 * Lists all scratchpad files recorded for a message turn.
 * Uses SQL `octet_length` projection to calculate byte sizes without transferring
 * up to 2MB of raw text content per row across the database boundary.
 *
 * @param messageId - Target message id
 * @returns The resolved result
 * @author Maruf Bepary
 */
export async function listScratchpadFiles(messageId: string): Promise<
  Array<
    Omit<
      {
        id: string;
        filePath: string;
        content: string;
        writtenByRole: string;
        version: number;
        createdAt: Date;
        updatedAt: Date;
      },
      "content"
    > & { sizeBytes: number }
  >
> {
  const rows = await db
    .select({
      id: subagentScratchpad.id,
      filePath: subagentScratchpad.filePath,
      writtenByRole: subagentScratchpad.writtenByRole,
      version: subagentScratchpad.version,
      sizeBytes: sql<number>`octet_length(${subagentScratchpad.content})`,
      createdAt: subagentScratchpad.createdAt,
      updatedAt: subagentScratchpad.updatedAt,
    })
    .from(subagentScratchpad)
    .where(eq(subagentScratchpad.messageId, messageId));

  return rows.map((r) => ({
    id: r.id,
    filePath: r.filePath,
    writtenByRole: r.writtenByRole,
    version: r.version,
    sizeBytes: Number(r.sizeBytes) || 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}
