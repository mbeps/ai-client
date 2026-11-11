import type { KbIngestStepId } from "@/types/knowledgebase/kb-ingest-steps";

/**
 * Knowledge base document upload constraints and accepted formats.
 */
export const KB_CONFIG = {
  ACCEPTED_EXTENSIONS: ".pdf,.txt,.md",
  ALLOWED_MIME_TYPES: new Set([
    "application/pdf",
    "text/plain",
    "text/markdown",
  ]),
  MAX_FILE_SIZE_MB: 50,
  MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
} as const;

/**
 * Ordered display definitions for document upload and ingestion progress steps.
 */
export const KB_INGEST_STEPS: ReadonlyArray<{
  id: KbIngestStepId;
  label: string;
}> = [
  { id: "uploading", label: "Uploading document" },
  { id: "extracting", label: "Extracting & chunking text" },
  { id: "embedding", label: "Generating embeddings" },
  { id: "metadata", label: "Generating metadata" },
  { id: "relations", label: "Creating relations" },
];
