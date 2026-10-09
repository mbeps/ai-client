import { and, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { subagentScratchpad } from "@/drizzle/schema";
import { getLogger } from "@/lib/logger";

const log = getLogger(["subagents", "scratchpad"]);

export interface UpsertScratchpadParams {
  chatId: string;
  messageId: string;
  filePath: string;
  content: string;
  writtenByRole: string;
}

export interface ScratchpadEntry {
  id: string;
  filePath: string;
  content: string;
  writtenByRole: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Normalises a file path to prevent directory traversal or relative path escapes.
 */
export function normaliseScratchpadPath(rawPath: string): string {
  const cleaned = rawPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.\.+/g, "")
    .replace(/\/+/g, "/")
    .replace(/^\/+/, "");
  return cleaned || "note.txt";
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

/**
 * Lists all scratchpad files recorded for a message turn.
 *
 * @author Maruf Bepary
 */
export async function listScratchpadFiles(
  messageId: string,
): Promise<Array<Omit<ScratchpadEntry, "content"> & { sizeBytes: number }>> {
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
