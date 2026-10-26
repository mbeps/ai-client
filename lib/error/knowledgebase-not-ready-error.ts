import { KB_NOT_READY_ERROR_CODE } from "@/lib/error/kb-not-ready-error-code";

/**
 * Error thrown when a knowledge base is not ready for search or retrieval operations.
 * Occurs when indexing/ingestion is still in progress or failed.
 * Includes knowledge base ID and current status for debugging.
 *
 * @author Maruf Bepary
 */
export class KnowledgebaseNotReadyError extends Error {
  readonly code = KB_NOT_READY_ERROR_CODE;
  readonly kbId: string;
  readonly status: string;

  constructor(kbId: string, status: string) {
    const message = `Knowledge base is not ready for search (status: ${status}). Please wait for indexing to complete.`;
    super(message);
    this.kbId = kbId;
    this.status = status;
    this.name = "KnowledgebaseNotReadyError";
  }
}
