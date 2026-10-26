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
import { attachment } from "@/drizzle/schemas/chat-schema";
import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { InvalidArtifactFormatError } from "@/lib/error/invalid-artifact-format-error";
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

const EXTENSION_MIME_MAP: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  pdf: "application/pdf",
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  zip: "application/zip",
  txt: "text/plain",
  mmd: "text/plain",
};

/**
 * Maps a file extension to its corresponding standard MIME type.
 *
 * @param filename - Target filename
 * @returns The resolved result
 * @author Maruf Bepary
 */
function inferMimeTypeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return (ext && EXTENSION_MIME_MAP[ext]) || "application/octet-stream";
}

/**
 * Represents resolved artifact payload.
 *
 * @author Maruf Bepary
 */
type ResolvedArtifactPayload = {
  fileBuffer: Buffer;
  outputName: string;
  mimeType: string;
};

const TEXT_ARTIFACT_CONFIG: Record<string, { ext: string; mimeType: string }> =
  {
    markdown: { ext: "md", mimeType: "text/markdown" },
    html: { ext: "html", mimeType: "text/html" },
    mermaid: { ext: "mmd", mimeType: "text/plain" },
  };

/**
 * Performs append multi sheets.
 *
 * @param workbook - Target workbook
 * @param sheets - Target sheets
 * @returns The resolved result
 * @author Maruf Bepary
 */
function appendMultiSheets(
  workbook: XLSX.WorkBook,
  sheets: Array<{ name?: string; data?: unknown[][] }>,
): void {
  for (const sheet of sheets) {
    const data = sheet.data || [];
    const name = sheet.name || "Sheet1";
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, ws, name);
  }
}

/**
 * Performs append sheets from parsed.
 *
 * @param workbook - Target workbook
 * @param parsed - Parsed data payload
 * @returns The resolved result
 * @author Maruf Bepary
 */
function appendSheetsFromParsed(
  workbook: XLSX.WorkBook,
  parsed: unknown,
): void {
  if (Array.isArray(parsed)) {
    const ws = XLSX.utils.aoa_to_sheet(parsed);
    XLSX.utils.book_append_sheet(workbook, ws, "Sheet1");
    return;
  }

  if (!parsed || typeof parsed !== "object") {
    return;
  }

  const obj = parsed as Record<string, unknown>;
  if (Array.isArray(obj.data)) {
    const ws = XLSX.utils.aoa_to_sheet(obj.data as unknown[][]);
    const name = typeof obj.name === "string" ? obj.name : "Sheet1";
    XLSX.utils.book_append_sheet(workbook, ws, name);
    return;
  }

  if (Array.isArray(obj.sheets)) {
    appendMultiSheets(
      workbook,
      obj.sheets as Array<{ name?: string; data?: unknown[][] }>,
    );
  }
}

/**
 * Constructs an XLSX workbook Buffer from JSON spreadsheet artifact content. Throws InvalidArtifactFormatError if the workbook has no sheets.
 *
 * @param artifactContent - Target artifact content
 * @returns The resolved result
 * @author Maruf Bepary
 */
function buildSpreadsheetBuffer(artifactContent: string): Buffer {
  const parsed = JSON.parse(artifactContent);
  const workbook = XLSX.utils.book_new();

  appendSheetsFromParsed(workbook, parsed);

  if (workbook.SheetNames.length === 0) {
    throw new InvalidArtifactFormatError(
      "Spreadsheet artifact contains no valid sheets or recognizable data structure",
    );
  }

  return Buffer.from(
    XLSX.write(workbook, {
      type: "array",
      bookType: "xlsx",
    }) as ArrayBuffer,
  );
}

/**
 * Resolves the file buffer, sanitized file name, and MIME type for artifact/download inputs. Returns null if the artifact content is empty or the artifact type is unsupported.
 *
 * @param input - Target input
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveArtifactPayload(
  input: PersistArtifactInput,
): ResolvedArtifactPayload | null {
  if (input.kind === "download") {
    const fileBuffer = Buffer.from(input.fileContent, "base64");
    const outputName = input.filename
      ? sanitiseFilename(input.filename)
      : `step-${input.stepIndex + 1}-output.xlsx`;
    const mimeType = inferMimeTypeFromFilename(outputName);
    return { fileBuffer, outputName, mimeType };
  }

  const artifactType =
    (input.artifact.type as string | undefined)?.toLowerCase() ?? "";
  const artifactContent = (input.artifact.content as string | undefined) ?? "";

  if (!artifactContent) {
    return null;
  }

  if (artifactType === "spreadsheet") {
    const fileBuffer = buildSpreadsheetBuffer(artifactContent);
    const outputName = `step-${input.stepIndex + 1}-output.xlsx`;
    const mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return { fileBuffer, outputName, mimeType };
  }

  const textConfig = TEXT_ARTIFACT_CONFIG[artifactType];
  if (textConfig) {
    const fileBuffer = Buffer.from(artifactContent, "utf-8");
    const outputName = `step-${input.stepIndex + 1}-output.${textConfig.ext}`;
    return { fileBuffer, outputName, mimeType: textConfig.mimeType };
  }

  return null;
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
  try {
    const payload = resolveArtifactPayload(input);
    if (!payload) {
      return null;
    }

    const { fileBuffer, outputName, mimeType } = payload;
    const outputAttachmentId = randomUUID();
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
