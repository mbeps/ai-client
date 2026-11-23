import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schemas/chat-schema";
import { getPresignedUrl } from "@/lib/storage/get-presigned-url";

/** A row from the attachment table passed during workflow execution. */
export type AttachmentRow = typeof attachment.$inferSelect;

/** Result of `buildFileContext`. */
export type FileContextResult = {
  fileContext: string;
  attachmentRows: AttachmentRow[];
};

/**
 * Queries attachment records for the given IDs and builds a file-context string with presigned URLs.
 */
export async function buildFileContext(
  inputAttachmentIds: string[],
  userId: string,
): Promise<FileContextResult> {
  if (inputAttachmentIds.length === 0) {
    return { fileContext: "", attachmentRows: [] };
  }

  const attachmentRows = await db
    .select()
    .from(attachment)
    .where(
      and(
        inArray(attachment.id, inputAttachmentIds),
        eq(attachment.userId, userId),
      ),
    );

  if (attachmentRows.length === 0) {
    return { fileContext: "", attachmentRows: [] };
  }

  const urlResults = await Promise.allSettled(
    attachmentRows.map((row) => getPresignedUrl(row.key)),
  );

  const fileLines: string[] = [];
  attachmentRows.forEach((row, idx) => {
    const result = urlResults[idx];
    if (result.status === "fulfilled") {
      const isOutput =
        row.key.includes("workflow-outputs/") ||
        row.key.includes("transform-outputs/");
      const prefix = isOutput ? "[Current workbook]" : "[Input]";
      fileLines.push(`${prefix} ${row.name}: ${result.value}`);
    }
  });

  let fileContext = "";
  if (fileLines.length > 0) {
    const hasOutputWorkbook = attachmentRows.some(
      (row) =>
        row.key.includes("workflow-outputs/") ||
        row.key.includes("transform-outputs/"),
    );
    fileContext = hasOutputWorkbook
      ? `The current workbook is the [Current workbook] file below. Use the upload_file tool (passing file_content=<URL> and filename=<name>) before processing. Do not treat the original input as an equal candidate now that a current workbook exists:\n${fileLines.join("\n")}`
      : `The user has attached files. Use the upload_file tool (passing file_content=<URL> and filename=<name>) to load a file before processing:\n${fileLines.join("\n")}`;
  }

  return { fileContext, attachmentRows };
}
