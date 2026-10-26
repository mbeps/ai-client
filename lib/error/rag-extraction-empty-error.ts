import { RAG_EXTRACTION_EMPTY_ERROR_CODE } from "@/lib/error/rag-extraction-empty-error-code";

/**
 * Error thrown when document extraction for RAG produces no usable content.
 * Occurs when file is empty, corrupted, or contains no extractable text.
 * Used in knowledge base document ingestion flow.
 *
 * @author Maruf Bepary
 */
export class RagExtractionEmptyError extends Error {
  readonly code = RAG_EXTRACTION_EMPTY_ERROR_CODE;

  constructor(
    message = "The RAG extraction resulted in no content to process",
  ) {
    super(message);
    this.name = "RagExtractionEmptyError";
  }
}
