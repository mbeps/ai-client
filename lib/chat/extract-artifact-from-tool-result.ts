import type { ArtifactData } from "@/types/artifact/artifact-data";

const VALID_ARTIFACT_TYPES = new Set([
  "markdown",
  "spreadsheet",
  "html",
  "mermaid",
] as const);

type ArtifactType = "markdown" | "spreadsheet" | "html" | "mermaid";

/**
 * Parses tool output payload if stringified JSON or validates object shape.
 */
function parseToolResultObject(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return raw && typeof raw === "object"
    ? (raw as Record<string, unknown>)
    : null;
}

/**
 * Resolves valid artifact type from raw artifact properties.
 */
function resolveArtifactType(
  rawArtifact: Record<string, unknown>,
): ArtifactType | null {
  const rawType =
    typeof rawArtifact.type === "string"
      ? rawArtifact.type.toLowerCase()
      : typeof rawArtifact.artifact_type === "string"
        ? rawArtifact.artifact_type.toLowerCase()
        : null;

  if (rawType && (VALID_ARTIFACT_TYPES as ReadonlySet<string>).has(rawType)) {
    return rawType as ArtifactType;
  }
  return null;
}

/**
 * Normalizes content string from string content, sheets array, or serialized object.
 */
function resolveArtifactContent(rawArtifact: Record<string, unknown>): string {
  if (typeof rawArtifact.content === "string") {
    return rawArtifact.content;
  }
  if (Array.isArray(rawArtifact.sheets)) {
    return JSON.stringify({ sheets: rawArtifact.sheets });
  }
  if (rawArtifact.content !== undefined) {
    return JSON.stringify(rawArtifact.content);
  }
  return "";
}

/**
 * Extracts unwrapped artifact record if wrapped in { artifact: ... }.
 */
function resolveRawArtifact(
  parsedRecord: Record<string, unknown>,
): Record<string, unknown> {
  if (
    "artifact" in parsedRecord &&
    parsedRecord.artifact &&
    typeof parsedRecord.artifact === "object"
  ) {
    return parsedRecord.artifact as Record<string, unknown>;
  }
  return parsedRecord;
}

/**
 * Resolves artifact title with default fallback.
 */
function resolveArtifactTitle(rawArtifact: Record<string, unknown>): string {
  if (typeof rawArtifact.title === "string" && rawArtifact.title.trim()) {
    return rawArtifact.title;
  }
  return "Untitled Artifact";
}

/**
 * Resolves artifact ID with toolCallId fallback or default.
 */
function resolveArtifactId(
  rawArtifact: Record<string, unknown>,
  toolCallId: unknown,
): string {
  if (typeof rawArtifact.id === "string" && rawArtifact.id.trim()) {
    return rawArtifact.id;
  }
  if (typeof toolCallId === "string") {
    return `${toolCallId}-artifact`;
  }
  return "artifact-default";
}

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

  const parsedRecord = parseToolResultObject(record.result ?? record.output);
  if (!parsedRecord) return null;

  const rawArtifact = resolveRawArtifact(parsedRecord);
  const type = resolveArtifactType(rawArtifact);
  if (!type) return null;

  return {
    id: resolveArtifactId(rawArtifact, record.toolCallId),
    type,
    title: resolveArtifactTitle(rawArtifact),
    content: resolveArtifactContent(rawArtifact),
  };
}
