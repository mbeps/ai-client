import type { ArtifactData } from "@/types/artifact/artifact-data";

/**
 * Extracts and normalizes structured ArtifactData from a tool result entry if present.
 * Tolerates:
 * - `tr.result` or `tr.output`
 * - Stringified JSON payload or raw object
 * - Nested `{ artifact: ... }` wrapper or flat artifact shape
 * - Raw `sheets` array converted to JSON string content
 *
 * @param tr - ToolResult entry from message metadata
 * @returns Normalized ArtifactData or null if not a valid artifact result
 * @author Maruf Bepary
 */
export function extractArtifactFromToolResult(
  tr: unknown,
): ArtifactData | null {
  if (!tr || typeof tr !== "object") return null;
  const record = tr as Record<string, unknown>;

  if (record.toolName !== "manage_artifact") return null;

  const raw = record.result ?? record.output;
  let parsed: unknown = raw;

  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object") return null;
  const parsedRecord = parsed as Record<string, unknown>;
  const rawArtifact =
    "artifact" in parsedRecord &&
    parsedRecord.artifact &&
    typeof parsedRecord.artifact === "object"
      ? (parsedRecord.artifact as Record<string, unknown>)
      : parsedRecord;

  const rawType =
    typeof rawArtifact.type === "string"
      ? rawArtifact.type.toLowerCase()
      : typeof rawArtifact.artifact_type === "string"
        ? rawArtifact.artifact_type.toLowerCase()
        : null;

  if (
    rawType !== "markdown" &&
    rawType !== "spreadsheet" &&
    rawType !== "html" &&
    rawType !== "mermaid"
  ) {
    return null;
  }

  const type: "markdown" | "spreadsheet" | "html" | "mermaid" = rawType;

  let content: string = "";
  if (typeof rawArtifact.content === "string") {
    content = rawArtifact.content;
  } else if (Array.isArray(rawArtifact.sheets)) {
    content = JSON.stringify({ sheets: rawArtifact.sheets });
  } else if (rawArtifact.content !== undefined) {
    content = JSON.stringify(rawArtifact.content);
  }

  const title =
    typeof rawArtifact.title === "string" && rawArtifact.title.trim()
      ? rawArtifact.title
      : "Untitled Artifact";

  const id =
    typeof rawArtifact.id === "string" && rawArtifact.id.trim()
      ? rawArtifact.id
      : typeof record.toolCallId === "string"
        ? `${record.toolCallId}-artifact`
        : "artifact-default";

  return {
    id,
    type,
    title,
    content,
  };
}
