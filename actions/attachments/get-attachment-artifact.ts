"use server";

import { and, eq } from "drizzle-orm";
import * as xlsx from "xlsx";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { getExtension } from "@/lib/attachments/get-extension";
import { requireSession } from "@/lib/auth/require-session";
import { downloadObject } from "@/lib/storage/download-object";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { ArtifactSheet } from "@/types/artifact/artifact-sheet";

/**
 * Downloads an attachment from storage on the server and builds a normalised
 * ArtifactData object according to file format and MIME type:
 * - Spreadsheets (.xlsx, .csv, etc.) -> parsed into sheets JSON structure
 * - HTML files (.html) -> HTML preview artifact
 * - Mermaid diagrams (.mmd) -> Mermaid diagram artifact
 * - Markdown, text, and structured code (.md, .txt, .json, etc.) -> Markdown preview artifact
 *
 * Used by step-by-step automation previews and canvas viewers to safely
 * load server-side attachments without client-side CORS or S3 issues.
 *
 * @param id - UUID of the attachment to retrieve; must belong to authenticated user.
 * @returns Normalised ArtifactData object for rendering in ArtifactPanel.
 * @throws Error if session is unauthenticated or attachment is not found.
 * @author Maruf Bepary
 */
export async function getAttachmentArtifact(id: string): Promise<ArtifactData> {
  const session = await requireSession();
  const validatedId = z.string().uuid().parse(id);

  const [row] = await db
    .select()
    .from(attachment)
    .where(
      and(
        eq(attachment.id, validatedId),
        eq(attachment.userId, session.user.id),
      ),
    );

  if (!row) {
    throw new Error("Not Found");
  }

  const buffer = await downloadObject(row.key);
  const ext = getExtension(row.name);
  const mime = (row.mimeType || "").toLowerCase();

  const isSpreadsheet =
    ext === ".xlsx" ||
    ext === ".xlsm" ||
    ext === ".xls" ||
    ext === ".csv" ||
    ext === ".tsv" ||
    ext === ".ods" ||
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("csv");

  if (isSpreadsheet) {
    const wb = xlsx.read(buffer, { type: "buffer" });
    const sheets: ArtifactSheet[] = wb.SheetNames.map((name) => {
      const rawData = xlsx.utils.sheet_to_json(wb.Sheets[name], {
        header: 1,
      }) as any[][];
      return { name, data: rawData.slice(0, 500) };
    });

    return {
      id: row.id,
      type: "spreadsheet",
      title: row.name,
      content: JSON.stringify({ sheets }),
    };
  }

  if (ext === ".html" || ext === ".htm" || mime.includes("html")) {
    return {
      id: row.id,
      type: "html",
      title: row.name,
      content: buffer.toString("utf-8"),
    };
  }

  if (ext === ".mmd" || mime.includes("mermaid")) {
    return {
      id: row.id,
      type: "mermaid",
      title: row.name,
      content: buffer.toString("utf-8"),
    };
  }

  const isImage =
    mime.startsWith("image/") ||
    ext === ".png" ||
    ext === ".jpg" ||
    ext === ".jpeg" ||
    ext === ".gif" ||
    ext === ".webp" ||
    ext === ".svg";

  if (isImage) {
    const effectiveMime = mime.startsWith("image/")
      ? mime
      : ext === ".svg"
        ? "image/svg+xml"
        : `image/${ext.replace(".", "")}`;
    return {
      id: row.id,
      type: "markdown",
      title: row.name,
      content: `![${row.name}](data:${effectiveMime};base64,${buffer.toString("base64")})`,
    };
  }

  const isBinary =
    ext === ".pdf" ||
    ext === ".zip" ||
    ext === ".tar" ||
    ext === ".gz" ||
    ext === ".bin" ||
    ext === ".exe" ||
    mime === "application/pdf" ||
    mime.includes("archive") ||
    mime.includes("zip") ||
    mime.startsWith("audio/") ||
    mime.startsWith("video/");

  if (isBinary) {
    return {
      id: row.id,
      type: "markdown",
      title: row.name,
      content: `### ${row.name}\n\n*Binary preview is not supported for this file type (${ext.replace(".", "").toUpperCase() || "binary"}). Please use the download link in the Files section below.*`,
    };
  }

  const textContent = buffer.toString("utf-8");
  const isCodeOrJson =
    ext === ".json" ||
    ext === ".jsonl" ||
    ext === ".js" ||
    ext === ".ts" ||
    ext === ".py" ||
    ext === ".sql" ||
    mime.includes("json");

  return {
    id: row.id,
    type: "markdown",
    title: row.name,
    content: isCodeOrJson
      ? `\`\`\`${ext.replace(".", "")}\n${textContent}\n\`\`\``
      : textContent,
  };
}
