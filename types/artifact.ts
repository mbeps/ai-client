/**
 * Data model for rendered artifacts (generated content from AI).
 * Supports Markdown, Spreadsheet (JSON), HTML, and Mermaid diagram types.
 */
export interface ArtifactData {
  /** Type of artifact: markdown, spreadsheet, html, or mermaid. */
  type: "markdown" | "spreadsheet" | "html" | "mermaid";

  /** Display title for the artifact. */
  title: string;

  /** Raw content string (Markdown, HTML, or stringified JSON for spreadsheet). */
  content: string;

  /** ID of the message that generated this artifact. */
  messageId?: string;
}
