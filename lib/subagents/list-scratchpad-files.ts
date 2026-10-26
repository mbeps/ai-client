import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { subagentScratchpad } from "@/drizzle/schemas/subagent-schema";

/**
 * Lists all scratchpad files recorded for a message turn.
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
      content: subagentScratchpad.content,
      writtenByRole: subagentScratchpad.writtenByRole,
      version: subagentScratchpad.version,
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
    sizeBytes: Buffer.byteLength(r.content, "utf8"),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}
