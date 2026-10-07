import * as xlsx from "xlsx";
import { getLogger } from "@/lib/logger";
import type { ArtifactData } from "@/types/artifact/artifact-data";

const log = getLogger(["app", "artifacts", "download"]);

/**
 * Downloads a canvas artifact as a file matching its content type:
 * - Spreadsheet: exported as `.xlsx` workbook
 * - Markdown: exported as `.md` file
 * - HTML: exported as `.html` file
 * - Mermaid: exported as `.mmd` diagram
 *
 * @param artifact - The artifact data to export.
 * @author Maruf Bepary
 */
export function downloadArtifact(artifact: ArtifactData): void {
  if (typeof window === "undefined" || !artifact) return;

  const title = artifact.title || "artifact";
  const safeTitle = title.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();

  if (artifact.type === "spreadsheet") {
    try {
      const parsed = JSON.parse(artifact.content);
      const workbook = xlsx.utils.book_new();

      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray(parsed.sheets)
      ) {
        // Multi-sheet format
        parsed.sheets.forEach((sheet: any) => {
          const flatData = sheet.data.map((row: any) =>
            row.map((cell: any) =>
              cell && typeof cell === "object" && "v" in cell ? cell.v : cell,
            ),
          );
          const worksheet = xlsx.utils.aoa_to_sheet(flatData);
          xlsx.utils.book_append_sheet(
            workbook,
            worksheet,
            sheet.name || "Sheet1",
          );
        });
      } else if (Array.isArray(parsed)) {
        // Legacy array format
        const worksheet = xlsx.utils.json_to_sheet(parsed);
        xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1");
      }

      xlsx.writeFile(workbook, `${safeTitle}.xlsx`);
      return;
    } catch (err) {
      log.error("Failed to export spreadsheet artifact as XLSX", { err });
    }
  }

  // Text-based artifact exports (markdown, html, mermaid, plain text)
  const extension =
    artifact.type === "markdown"
      ? "md"
      : artifact.type === "html"
        ? "html"
        : artifact.type === "mermaid"
          ? "mmd"
          : "txt";

  const mimeType =
    artifact.type === "html"
      ? "text/html;charset=utf-8"
      : "text/plain;charset=utf-8";

  const blob = new Blob([artifact.content], { type: mimeType });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${safeTitle}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(objectUrl);
}
