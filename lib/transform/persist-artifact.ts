/**
 * Persists a transform step output as an S3 attachment.
 * Supports two persistence paths:
 *
 * - `"artifact"`:  a `manage_artifact` spreadsheet result → convert to XLSX → upload
 * - `"download"`:   a `download_file` tool result (base64) → upload
 *
 * Returns the new output attachment IDs and the new attachment row, or `null`
 * when no persistence was applicable.
 */

import { randomUUID } from "crypto";
import * as XLSX from "xlsx";
import { db } from "@/drizzle/db";
import { attachment, transformRun } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { uploadObject } from "@/lib/storage/s3-client";
import { logger } from "@/lib/logger";
import type { AttachmentRow } from "@/lib/transform/build-file-context";

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

/**
 * Persists a transform step output to S3 and creates an attachment record.
 *
 * @param input  - Discriminated persistence input.
 * @param userId - Owning user ID.
 * @param runId  - Transform run ID.
 * @returns The new output attachment IDs and row, or `null` if persistence
 *          could not be completed (e.g. malformed artifact content).
 */
export async function persistTransformArtifact(
  input: PersistArtifactInput,
  userId: string,
  runId: string,
): Promise<PersistArtifactResult | null> {
  switch (input.kind) {
    case "artifact":
      return persistArtifact(input, userId, runId);
    case "download":
      return persistDownload(input, userId, runId);
  }
}

/* ── internal helpers ────────────────────────────────────────────────── */

async function persistArtifact(
  input: Extract<PersistArtifactInput, { kind: "artifact" }>,
  userId: string,
  runId: string,
): Promise<PersistArtifactResult | null> {
  const artifactType = (input.artifact.type as string | undefined) ?? "";
  const artifactContent = (input.artifact.content as string | undefined) ?? "";

  if (artifactType.toLowerCase() !== "spreadsheet" || !artifactContent) {
    return null;
  }

  try {
    const parsed = JSON.parse(artifactContent);
    const workbook = XLSX.utils.book_new();

    for (const sheet of (parsed.sheets ?? []) as Array<{
      name?: string;
      data?: unknown[][];
    }>) {
      const ws = XLSX.utils.aoa_to_sheet(sheet.data ?? []);
      XLSX.utils.book_append_sheet(workbook, ws, sheet.name ?? "Sheet1");
    }

    const xlsxBuffer = Buffer.from(
      XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer,
    );

    const outputName = `step-${input.stepIndex + 1}-output.xlsx`;
    const outputAttachmentId = randomUUID();
    const s3Key = `transform-outputs/${userId}/${outputAttachmentId}-${outputName}`;
    const mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    await uploadObject(s3Key, xlsxBuffer, mimeType);

    await db.insert(attachment).values({
      id: outputAttachmentId,
      userId,
      transformRunId: runId,
      name: outputName,
      mimeType,
      size: xlsxBuffer.length,
      key: s3Key,
    });

    logger.info("[Transform AI] Persisted spreadsheet artifact output", {
      runId,
      stepIndex: input.stepIndex,
      outputAttachmentId,
      outputName,
    });

    const attachmentRow: AttachmentRow = {
      id: outputAttachmentId,
      messageId: null,
      transformRunId: runId,
      userId,
      name: outputName,
      mimeType,
      size: xlsxBuffer.length,
      key: s3Key,
      extractedText: null,
      createdAt: new Date(),
    };

    // Persist in run record so resume logic picks up the latest workbook
    await db
      .update(transformRun)
      .set({ outputAttachmentIds: [outputAttachmentId] })
      .where(eq(transformRun.id, runId));

    return {
      outputAttachmentIds: [outputAttachmentId],
      attachmentRow,
    };
  } catch (err) {
    logger.warn(
      "[Transform AI] Failed to persist step output as xlsx",
      { err },
      userId,
    );
    return null;
  }
}

async function persistDownload(
  input: Extract<PersistArtifactInput, { kind: "download" }>,
  userId: string,
  runId: string,
): Promise<PersistArtifactResult | null> {
  try {
    const xlsxBuffer = Buffer.from(input.fileContent, "base64");
    const outputAttachmentId = randomUUID();
    const outputName =
      input.filename || `step-${input.stepIndex + 1}-output.xlsx`;
    const s3Key = `transform-outputs/${userId}/${outputAttachmentId}-${outputName}`;
    const mimeType =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    await uploadObject(s3Key, xlsxBuffer, mimeType);

    await db.insert(attachment).values({
      id: outputAttachmentId,
      userId,
      transformRunId: runId,
      name: outputName,
      mimeType,
      size: xlsxBuffer.length,
      key: s3Key,
    });

    const attachmentRow: AttachmentRow = {
      id: outputAttachmentId,
      messageId: null,
      transformRunId: runId,
      userId,
      name: outputName,
      mimeType,
      size: xlsxBuffer.length,
      key: s3Key,
      extractedText: null,
      createdAt: new Date(),
    };

    await db
      .update(transformRun)
      .set({ outputAttachmentIds: [outputAttachmentId] })
      .where(eq(transformRun.id, runId));

    logger.info("[Transform AI] Persisted step output from download_file", {
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
    logger.warn(
      "[Transform AI] download_file persistence failed",
      { err, runId, stepIndex: input.stepIndex },
      userId,
    );
    return null;
  }
}
