"use server";

import * as xlsx from "xlsx";
import { requireUserAttachment } from "@/lib/attachments/attachment-auth";
import { getExtension } from "@/lib/attachments/get-extension";
import { downloadObject } from "@/lib/storage/download-object";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { ArtifactSheet } from "@/types/artifact/artifact-sheet";

const SPREADSHEET_EXTS = new Set([
  ".xlsx",
  ".xlsm",
  ".xls",
  ".csv",
  ".tsv",
  ".ods",
]);

const HTML_EXTS = new Set([".html", ".htm"]);

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

const BINARY_EXTS = new Set([".pdf", ".zip", ".tar", ".gz", ".bin", ".exe"]);

const CODE_OR_JSON_EXTS = new Set([
  ".json",
  ".jsonl",
  ".js",
  ".ts",
  ".py",
  ".sql",
]);

/**
 * Checks if the file extension or MIME type represents a spreadsheet or CSV.
 *
 * @param ext - Normalized file extension including leading dot
 * @param mime - MIME type string
 * @returns True if the file is a tabular/spreadsheet format
 * @author Maruf Bepary
 */
function isSpreadsheetFile(ext: string, mime: string): boolean {
  if (SPREADSHEET_EXTS.has(ext)) {
    return true;
  }
  return (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime.includes("csv")
  );
}

/**
 * Parses binary spreadsheet buffer into JSON artifact representation.
 *
 * @param buffer - File content buffer
 * @returns Serialized JSON string containing sheet data
 * @author Maruf Bepary
 */
function parseSpreadsheetContent(buffer: Buffer): string {
  const wb = xlsx.read(buffer, { type: "buffer" });
  const sheets: ArtifactSheet[] = wb.SheetNames.map((name) => {
    const rawData = xlsx.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
    }) as any[][];
    return { name, data: rawData.slice(0, 500) };
  });

  return JSON.stringify({ sheets });
}

/**
 * Determines whether a file represents HTML content based on extension or MIME type.
 *
 * @param ext - Normalized file extension
 * @param mime - MIME type string
 * @returns True if HTML
 * @author Maruf Bepary
 */
function isHtmlFile(ext: string, mime: string): boolean {
  return HTML_EXTS.has(ext) || mime.includes("html");
}

/**
 * Determines whether a file represents Mermaid diagram markup.
 *
 * @param ext - Normalized file extension
 * @param mime - MIME type string
 * @returns True if Mermaid diagram
 * @author Maruf Bepary
 */
function isMermaidFile(ext: string, mime: string): boolean {
  return ext === ".mmd" || mime.includes("mermaid");
}

/**
 * Determines whether a file is an image based on MIME type prefix or extension.
 *
 * @param ext - Normalized file extension
 * @param mime - MIME type string
 * @returns True if image
 * @author Maruf Bepary
 */
function isImageFile(ext: string, mime: string): boolean {
  return mime.startsWith("image/") || IMAGE_EXTS.has(ext);
}

/**
 * Resolves a normalized image MIME type.
 *
 * @param ext - Normalized file extension
 * @param mime - MIME type string
 * @returns Valid image MIME string
 * @author Maruf Bepary
 */
function resolveImageMime(ext: string, mime: string): string {
  if (mime.startsWith("image/")) {
    return mime;
  }
  if (ext === ".svg") {
    return "image/svg+xml";
  }
  return `image/${ext.replace(".", "")}`;
}

/**
 * Formats image buffer into an inline base64 markdown preview.
 *
 * @param name - Display name of the image
 * @param ext - Normalized file extension
 * @param mime - MIME type string
 * @param buffer - Raw image buffer
 * @returns Markdown image data URL string
 * @author Maruf Bepary
 */
function formatImageArtifactContent(
  name: string,
  ext: string,
  mime: string,
  buffer: Buffer,
): string {
  const effectiveMime = resolveImageMime(ext, mime);
  return `![${name}](data:${effectiveMime};base64,${buffer.toString("base64")})`;
}

/**
 * Checks if a file is an un-renderable binary file (PDF, archive, audio, video).
 *
 * @param ext - Normalized file extension
 * @param mime - MIME type string
 * @returns True if binary
 * @author Maruf Bepary
 */
function isBinaryFile(ext: string, mime: string): boolean {
  if (BINARY_EXTS.has(ext) || mime === "application/pdf") {
    return true;
  }
  if (mime.startsWith("audio/") || mime.startsWith("video/")) {
    return true;
  }
  return mime.includes("archive") || mime.includes("zip");
}

/**
 * Formats fallback markdown notice for binary files.
 *
 * @param name - File display name
 * @param ext - Normalized file extension
 * @returns Markdown advisory message
 * @author Maruf Bepary
 */
function formatBinaryArtifactContent(name: string, ext: string): string {
  const fileType = ext.replace(".", "").toUpperCase() || "binary";
  return `### ${name}\n\n*Binary preview is not supported for this file type (${fileType}). Please use the download link in the Files section below.*`;
}

/**
 * Formats text buffer into code block or raw text artifact content.
 *
 * @param ext - Normalized file extension
 * @param mime - MIME type string
 * @param buffer - Raw text buffer
 * @returns Formatted markdown string
 * @author Maruf Bepary
 */
function formatTextArtifactContent(
  ext: string,
  mime: string,
  buffer: Buffer,
): string {
  const textContent = buffer.toString("utf-8");
  const isCodeOrJson = CODE_OR_JSON_EXTS.has(ext) || mime.includes("json");

  if (isCodeOrJson) {
    return `\`\`\`${ext.replace(".", "")}\n${textContent}\n\`\`\``;
  }

  return textContent;
}

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
  const { attachment: row } = await requireUserAttachment(id);

  const buffer = await downloadObject(row.key);
  const ext = getExtension(row.name);
  const mime = (row.mimeType || "").toLowerCase();

  if (isSpreadsheetFile(ext, mime)) {
    return {
      id: row.id,
      type: "spreadsheet",
      title: row.name,
      content: parseSpreadsheetContent(buffer),
    };
  }

  if (isHtmlFile(ext, mime)) {
    return {
      id: row.id,
      type: "html",
      title: row.name,
      content: buffer.toString("utf-8"),
    };
  }

  if (isMermaidFile(ext, mime)) {
    return {
      id: row.id,
      type: "mermaid",
      title: row.name,
      content: buffer.toString("utf-8"),
    };
  }

  if (isImageFile(ext, mime)) {
    return {
      id: row.id,
      type: "markdown",
      title: row.name,
      content: formatImageArtifactContent(row.name, ext, mime, buffer),
    };
  }

  if (isBinaryFile(ext, mime)) {
    return {
      id: row.id,
      type: "markdown",
      title: row.name,
      content: formatBinaryArtifactContent(row.name, ext),
    };
  }

  return {
    id: row.id,
    type: "markdown",
    title: row.name,
    content: formatTextArtifactContent(ext, mime, buffer),
  };
}
