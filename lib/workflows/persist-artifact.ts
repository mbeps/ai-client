import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schemas/chat-schema";
import { workflowRun } from "@/drizzle/schemas/workflow-schema";
import { InvalidArtifactFormatError } from "@/lib/error/invalid-artifact-format-error";
import { getLogger } from "@/lib/logger";
import { uploadObject } from "@/lib/storage/upload-object";
import { sanitiseFilename } from "@/lib/utils/sanitise-filename";
import type { AttachmentRow } from "@/lib/workflows/build-file-context";

const log = getLogger(["app", "workflows", "artifact"]);

/** Discriminated input for workflow artifact persistence. */
export type PersistArtifactInput =
  | {
      kind: "artifact";
      artifact: Record<string, unknown>;
      stepIndex: number;
    }
  | {
      kind: "download";
      fileContent: string;
      filename: string;
      stepIndex: number;
    };

/** Result of a successful artifact persistence operation. */
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

const TEXT_ARTIFACT_CONFIG: Record<string, { ext: string; mimeType: string }> =
  {
    markdown: { ext: "md", mimeType: "text/markdown" },
    html: { ext: "html", mimeType: "text/html" },
    mermaid: { ext: "mmd", mimeType: "text/plain" },
  };

function inferMimeTypeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return (ext && EXTENSION_MIME_MAP[ext]) || "application/octet-stream";
}

function appendMultiSheets(
  workbook: XLSX.WorkBook,
  sheets: Array<{ name?: string; data?: unknown[][] }>,
): void {
  for (const sheet of sheets) {
    const rawData = sheet.data || [];
    const rows =
      Array.isArray(rawData) &&
      rawData.length === 1 &&
      Array.isArray(rawData[0]) &&
      Array.isArray((rawData[0] as unknown[])[0])
        ? (rawData[0] as unknown[][])
        : rawData;
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name || "Sheet1");
  }
}

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

function resolveArtifactPayload(input: PersistArtifactInput): {
  fileBuffer: Buffer;
  outputName: string;
  mimeType: string;
} | null {
  if (input.kind === "download") {
    const fileBuffer = Buffer.from(input.fileContent, "base64");
    const outputName = input.filename
      ? sanitiseFilename(input.filename)
      : `step-${input.stepIndex + 1}-output.xlsx`;
    return {
      fileBuffer,
      outputName,
      mimeType: inferMimeTypeFromFilename(outputName),
    };
  }

  const artifactType =
    (input.artifact.type as string | undefined)?.toLowerCase() ?? "";
  const artifactContent = (input.artifact.content as string | undefined) ?? "";
  if (!artifactContent) return null;

  if (artifactType === "spreadsheet") {
    return {
      fileBuffer: buildSpreadsheetBuffer(artifactContent),
      outputName: `step-${input.stepIndex + 1}-output.xlsx`,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  const textConfig = TEXT_ARTIFACT_CONFIG[artifactType];
  if (textConfig) {
    return {
      fileBuffer: Buffer.from(artifactContent, "utf-8"),
      outputName: `step-${input.stepIndex + 1}-output.${textConfig.ext}`,
      mimeType: textConfig.mimeType,
    };
  }

  return null;
}

/**
 * Persists a workflow node output artifact or download file to S3 and records an attachment linked to `workflow_run`.
 */
export async function persistWorkflowArtifact(
  input: PersistArtifactInput,
  userId: string,
  runId: string,
): Promise<PersistArtifactResult | null> {
  try {
    const payload = resolveArtifactPayload(input);
    if (!payload) return null;

    const { fileBuffer, outputName, mimeType } = payload;
    const outputAttachmentId = randomUUID();
    const s3Key = `workflow-outputs/${userId}/${outputAttachmentId}-${outputName}`;

    await db.insert(attachment).values({
      id: outputAttachmentId,
      userId,
      workflowRunId: runId,
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

    await db
      .update(workflowRun)
      .set({
        outputAttachmentIds: sql`array_append(output_attachment_ids, ${outputAttachmentId})`,
      })
      .where(eq(workflowRun.id, runId));

    const attachmentRow: AttachmentRow = {
      id: outputAttachmentId,
      messageId: null,
      workflowRunId: runId,
      userId,
      name: outputName,
      mimeType,
      size: fileBuffer.length,
      key: s3Key,
      extractedText: null,
      createdAt: new Date(),
    };

    log.info("Persisted {kind} output for workflow run {runId}", {
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
    log.warn(
      "Failed to persist {kind} output for workflow run {runId}: {error}",
      {
        kind: input.kind,
        runId,
        stepIndex: input.stepIndex,
        error: err instanceof Error ? err.message : String(err),
      },
    );
    return null;
  }
}
