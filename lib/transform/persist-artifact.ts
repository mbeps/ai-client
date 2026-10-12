/**
 * Persists a transform step output as an S3 attachment.
 * Supports two persistence paths:
 *
 * - "artifact":  a manage_artifact spreadsheet result -> convert to XLSX -> upload
 * - "download":   a download_file tool result (base64) -> upload
 *
 * Returns the new output attachment IDs and the new attachment row, or null
 * when no persistence was applicable.
 */

import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db } from "@/drizzle/db";
import { attachment, transformRun } from "@/drizzle/schema";
import { InvalidArtifactFormatError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import { uploadObject } from "@/lib/storage/upload-object";
import type { AttachmentRow } from "@/lib/transform/build-file-context";
import { sanitiseFilename } from "@/lib/utils/sanitise-filename";

const log = getLogger(["app", "transform", "artifact"]);

/** Discriminated input for the two persistence paths. */
export type PersistArtifactInput =
  | {
      kind: "artifact";
      /** The extracted artifact record (must have type=spreadsheet + content). */
      artifact: Record<string, unknown>;
      /** Current step index (used for naming the output file). */
      stepIndex: number;
    }
  | {
      kind: "download";
      /** Base64-encoded file content from the download_file tool. */
      fileContent: string;
      /** Original filename from the tool result. */
      filename: string;
      /** Current step index (used for naming the output file). */
      stepIndex: number;
    };

/** Result of a successful persistence operation. */
export type PersistArtifactResult = {
  outputAttachmentIds: string[];
  attachmentRow: AttachmentRow;
};

/** Maps a file extension to its corresponding standard MIME type. */
function inferMimeTypeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xlsm":
      return "application/vnd.ms-excel.sheet.macroEnabled.12";
    case "xls":
      return "application/vnd.ms-excel";
    case "csv":
      return "text/csv";
    case "pdf":
      return "application/pdf";
    case "md":
    case "markdown":
      return "text/markdown";
    case "html":
    case "htm":
      return "text/html";
    case "json":
      return "application/json";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "zip":
      return "application/zip";
    case "txt":
    case "mmd":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

/**
 * Persists a transform step output to S3 and creates an attachment record.
 * Supports all four canvas artifact types (spreadsheet, markdown, html, mermaid)
 * and generic tool file downloads (xlsx, pdf, csv, etc.).
 *
 * @param input  - Discriminated persistence input.
 * @param userId - Owning user ID.
 * @param runId  - Transform run ID.
 * @returns The new output attachment IDs and row, or null if persistence
 *          could not be completed (e.g. malformed artifact content).
 */
export async function persistTransformArtifact(
  input: PersistArtifactInput,
  userId: string,
  runId: string,
): Promise<PersistArtifactResult | null> {
  const outputAttachmentId = randomUUID();
  let outputName: string;
  let fileBuffer: Buffer;
  let mimeType: string;

  try {
    if (input.kind === "artifact") {
      const artifactType =
        (input.artifact.type as string | undefined)?.toLowerCase() ?? "";
      const artifactContent =
        (input.artifact.content as string | undefined) ?? "";

      if (!artifactContent) {
        return null;
      }

      if (artifactType === "spreadsheet") {
        const parsed = JSON.parse(artifactContent);
        const workbook = XLSX.utils.book_new();

        if (Array.isArray(parsed)) {
          const ws = XLSX.utils.aoa_to_sheet(parsed);
          XLSX.utils.book_append_sheet(workbook, ws, "Sheet1");
        } else if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as any).data)
        ) {
          const ws = XLSX.utils.aoa_to_sheet((parsed as any).data);
          XLSX.utils.book_append_sheet(
            workbook,
            ws,
            (parsed as any).name ?? "Sheet1",
          );
        } else if (
          parsed &&
          typeof parsed === "object" &&
          Array.isArray((parsed as any).sheets)
        ) {
          for (const sheet of (parsed as any).sheets as Array<{
            name?: string;
            data?: unknown[][];
          }>) {
            const ws = XLSX.utils.aoa_to_sheet(sheet.data ?? []);
            XLSX.utils.book_append_sheet(workbook, ws, sheet.name ?? "Sheet1");
          }
        }

        if (workbook.SheetNames.length === 0) {
          throw new InvalidArtifactFormatError(
            "Spreadsheet artifact contains no valid sheets or recognizable data structure",
          );
        }

        fileBuffer = Buffer.from(
          XLSX.write(workbook, {
            type: "array",
            bookType: "xlsx",
          }) as ArrayBuffer,
        );
        outputName = `step-${input.stepIndex + 1}-output.xlsx`;
        mimeType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else if (artifactType === "markdown") {
        fileBuffer = Buffer.from(artifactContent, "utf-8");
        outputName = `step-${input.stepIndex + 1}-output.md`;
        mimeType = "text/markdown";
      } else if (artifactType === "html") {
        fileBuffer = Buffer.from(artifactContent, "utf-8");
        outputName = `step-${input.stepIndex + 1}-output.html`;
        mimeType = "text/html";
      } else if (artifactType === "mermaid") {
        fileBuffer = Buffer.from(artifactContent, "utf-8");
        outputName = `step-${input.stepIndex + 1}-output.mmd`;
        mimeType = "text/plain";
      } else {
        // Unknown / unsupported artifact type
        return null;
      }
    } else {
      fileBuffer = Buffer.from(input.fileContent, "base64");
      outputName = input.filename
        ? sanitiseFilename(input.filename)
        : `step-${input.stepIndex + 1}-output.xlsx`;
      mimeType = inferMimeTypeFromFilename(outputName);
    }

    const s3Key = `transform-outputs/${userId}/${outputAttachmentId}-${outputName}`;

    // 1. DB record first, then upload; compensate by deleting the row if S3
    // fails so a failed upload never leaves a dangling attachment record.
    await db.insert(attachment).values({
      id: outputAttachmentId,
      userId,
      transformRunId: runId,
      name: outputName,
      mimeType,
      size: fileBuffer.length,
      key: s3Key,
    });

    try {
      await uploadObject(s3Key, fileBuffer, mimeType);
    } catch (err) {
      await db.delete(attachment).where(eq(attachment.id, outputAttachmentId));
      throw err;
    }

    // 2. Update the run record output state
    // Persist in run record so resume logic picks up the latest workbook.
    // Atomic append — concurrent steps must not overwrite each other's ids.
    await db
      .update(transformRun)
      .set({
        outputAttachmentIds: sql`array_append(output_attachment_ids, ${outputAttachmentId})`,
      })
      .where(eq(transformRun.id, runId));

    const attachmentRow: AttachmentRow = {
      id: outputAttachmentId,
      messageId: null,
      transformRunId: runId,
      userId,
      name: outputName,
      mimeType,
      size: fileBuffer.length,
      key: s3Key,
      extractedText: null,
      createdAt: new Date(),
    };

    log.info("Persisted {kind} output for run {runId} at step {stepIndex}", {
      kind: input.kind,
      runId,
      stepIndex: input.stepIndex,
      outputAttachmentId,
      outputName,
    });

    return {
      outputAttachmentIds: [outputAttachmentId],
      attachmentRow,
    };
  } catch (err) {
    if (err instanceof InvalidArtifactFormatError) {
      throw err;
    }
    log.warn("Failed to persist {kind} output for run {runId}: {error}", {
      kind: input.kind,
      runId,
      stepIndex: input.stepIndex,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
