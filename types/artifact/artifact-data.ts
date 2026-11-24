import type { ArtifactType } from "@/config/artifacts";

/**
 * Data model for rendered artifacts (generated content from AI).
 * Supports Markdown, Spreadsheet (JSON), HTML, Mermaid diagram, and Interactive UI types.
 * Includes optional messageId for tracking which message generated the artifact.
 * Used for storing and rendering AI-generated content alongside chat.
 *
 * @author Maruf Bepary
 */
export interface ArtifactData {
  /** Type of artifact: markdown, spreadsheet, html, mermaid, or ui. */
  type: ArtifactType;

  /** Display title for the artifact. */
  title: string;

  /** Raw content string (Markdown, HTML, or stringified JSON for spreadsheet).
   */
  content: string;

  /** Stable unique identifier for this artifact (assigned by the manage_artifact tool). */
  id: string;

  /** ID of the message that generated this artifact. */
  messageId?: string;
}
