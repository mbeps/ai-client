/**
 * Centralised artifact types supported across Canvas, tool schemas, and extractors.
 *
 * @author Maruf Bepary
 */
export const ARTIFACT_TYPES = [
  "markdown",
  "spreadsheet",
  "html",
  "mermaid",
  "ui",
] as const;

/**
 * Union of all supported Canvas artifact types.
 *
 * @author Maruf Bepary
 */
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];
