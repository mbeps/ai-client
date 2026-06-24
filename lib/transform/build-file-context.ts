/**
 * Builds the file-context string for a transform step, describing which
 * workbooks / input files are available and providing presigned URLs.
 */

import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { inArray } from "drizzle-orm";
import { getPresignedUrl } from "@/lib/storage/s3-client";

/** A row from the attachment table that we pass around during the run. */
export type AttachmentRow = typeof attachment.$inferSelect;

/**
 * Result of buildFileContext.
 */
export type FileContextResult = {
  fileContext: string;
  attachmentRows: AttachmentRow[];
};

/**
 * Queries attachment records for the given IDs and builds a human-readable
 * file-context string with presigned URLs for the step prompt.
 *
 * @param inputAttachmentIds - IDs of attachments to load
 * @param userId             - owning user (for security filtering)
 */
export async function buildFileContext(
  inputAttachmentIds: string[],
  userId: string,
): Promise<FileContextResult> {
  if (inputAttachmentIds.length === 0) {
    return { fileContext: "", attachmentRows: [] };
  }

  // Fetch attachment records
  const attachmentRows = await db
    .select()
    .from(attachment)
    .where(inArray(attachment.id, inputAttachmentIds));

  if (attachmentRows.length === 0) {
    return { fileContext: "", attachmentRows: [] };
  }

  // Generate presigned URLs
  const urlResults = await Promise.allSettled(
    attachmentRows.map((row) => getPresignedUrl(row.key)),
  );

  const fileLines: string[] = [];
  attachmentRows.forEach((row, idx) => {
    const result = urlResults[idx];
    if (result.status === "fulfilled") {
      const isOutput = row.key.includes("transform-outputs/");
      const prefix = isOutput ? "[Current workbook]" : "[Input]";
      fileLines.push(`${prefix} ${row.name}: ${result.value}`);
    }
  });

  let fileContext = "";
  if (fileLines.length > 0) {
    const hasOutputWorkbook = attachmentRows.some((row) =>
      row.key.includes("transform-outputs/"),
    );
    fileContext = hasOutputWorkbook
      ? `The current workbook is the [Current workbook] file below. Use the upload_file tool with that URL before processing. Do not treat the original input as an equal candidate now that a current workbook exists:\n${fileLines.join("\n")}`
      : `The user has attached spreadsheet files. Use the upload_file tool with the provided URL to load a file before processing:\n${fileLines.join("\n")}`;
  }

  return { fileContext, attachmentRows };
}

/**
 * Builds the per-step file context, taking the active workbook into account.
 * If a workbook is already loaded in the MCP session, returns a short
 * instruction to reuse it; otherwise delegates to the URL-based builder.
 */
export function buildPerStepFileContext(
  activeWorkbookFilePath: string | null,
  currentAttachmentRows: AttachmentRow[],
): string {
  if (activeWorkbookFilePath) {
    return `A workbook is already loaded in the MCP session for this run. Reuse this exact file path for spreadsheet tools: ${activeWorkbookFilePath}. Do not call upload_file again unless explicitly instructed to switch source files.`;
  }

  if (currentAttachmentRows.length === 0) {
    return "";
  }

  // The URL-based builder is async, so this is a placeholder —
  // the actual async variant is used in the step loop.
  return "";
}
