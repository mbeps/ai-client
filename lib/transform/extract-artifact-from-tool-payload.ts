import { normaliseToolPayload } from "./normalise-tool-payload";

/**
 * Extracts a structured artifact from a tool payload if one is present.
 * Handles both `{ artifact: ... }` and flat shapes, normalises type/content fields.
 * Returns `null` when no valid structured artifact is found.
 */
export function extractArtifactFromToolPayload(
  payload: unknown,
): Record<string, unknown> | null {
  const normalised = normaliseToolPayload(payload);
  if (!normalised || typeof normalised !== "object") return null;

  const record = normalised as Record<string, unknown>;
  const rawArtifact =
    "artifact" in record
      ? normaliseToolPayload(record.artifact)
      : normaliseToolPayload(normalised);

  if (!rawArtifact || typeof rawArtifact !== "object") return null;

  const artifact = { ...(rawArtifact as Record<string, unknown>) };

  if (
    typeof artifact.type !== "string" &&
    typeof artifact.artifact_type === "string"
  ) {
    artifact.type = artifact.artifact_type;
  }

  if (typeof artifact.content !== "string" && Array.isArray(artifact.sheets)) {
    artifact.content = JSON.stringify({ sheets: artifact.sheets });
  }

  if (typeof artifact.title !== "string") {
    artifact.title = "Artifact";
  }

  const hasStructuredArtifact =
    typeof artifact.type === "string" && typeof artifact.content === "string";

  return hasStructuredArtifact ? artifact : null;
}
