/**
 * Standard error message for a missing provider API key.
 * Used across the application to identify and handle API configuration issues.
 * @author Maruf Bepary
 */
export const MISSING_API_KEY_ERROR =
  "API key not found for this provider. Please configure it in Settings > App.";

/** Error code for provider not configured or not found. */
export const PROVIDER_NOT_CONFIGURED_ERROR_CODE =
  "PROVIDER_NOT_CONFIGURED" as const;

/** Error code for corrupted or invalid provider credentials. */
export const PROVIDER_KEY_CORRUPTED_ERROR_CODE =
  "PROVIDER_KEY_CORRUPTED" as const;

/** Error code for knowledge base not ready for operations. */
export const KB_NOT_READY_ERROR_CODE = "KB_NOT_READY" as const;

/** Error code for model with malformed or missing ID. */
export const MODEL_MALFORMED_ID_ERROR_CODE = "MODEL_MALFORMED_ID" as const;

/** Error code for rate limiting (HTTP 429). */
export const RATE_LIMIT_ERROR_CODE = "RATE_LIMIT" as const;

/** Error code for unauthorized access or expired session. */
export const UNAUTHORIZED_ERROR_CODE = "UNAUTHORIZED" as const;

/** Standard error message for unauthorized/expired session. */
export const UNAUTHORIZED_ERROR_MESSAGE =
  "Your session has expired. Please log in again.";

/**
 * Error thrown when an API provider rate limit has been exceeded.
 * Indicates the request should be retried after a delay specified by retryAfter.
 *
 * @see Use for implementing exponential backoff retry strategies
 * @author Maruf Bepary
 */
export class RateLimitError extends Error {
  readonly code = RATE_LIMIT_ERROR_CODE;
  readonly status = 429;
  readonly isRetryable = true;
  readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when an AI provider or model is not configured or enabled.
 * Occurs when user attempts to use a provider without setting up credentials or enabling models.
 *
 * @author Maruf Bepary
 */
export class ProviderNotConfiguredError extends Error {
  readonly code = PROVIDER_NOT_CONFIGURED_ERROR_CODE;

  constructor(message = "No AI provider/model configured for this request") {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}

/**
 * Error thrown when one or more models have missing or invalid IDs during import/sync.
 * Indicates data integrity issues that prevent the model from being used.
 *
 * @author Maruf Bepary
 */
export class ModelMalformedIdError extends Error {
  readonly code = MODEL_MALFORMED_ID_ERROR_CODE;
  readonly invalidCount: number;

  constructor(invalidCount: number) {
    const message = `${invalidCount} model(s) were skipped due to missing or invalid ID`;
    super(message);
    this.invalidCount = invalidCount;
    this.name = "ModelMalformedIdError";
  }
}

/**
 * Error thrown when provider credentials (API key, headers) fail to decrypt.
 * Indicates stored credentials are corrupted or the encryption key has changed.
 *
 * @author Maruf Bepary
 */
export class ProviderKeyCorruptedError extends Error {
  readonly code = PROVIDER_KEY_CORRUPTED_ERROR_CODE;

  constructor(message = "Provider credentials are invalid or corrupted") {
    super(message);
    this.name = "ProviderKeyCorruptedError";
  }
}

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

/** Error code for generic model capability missing. */
export const MODEL_CAPABILITY_ERROR_CODE = "MODEL_CAPABILITY_ERROR" as const;

/** Error code for model not supporting vision/image analysis. */
export const VISION_NOT_SUPPORTED_ERROR_CODE = "VISION_NOT_SUPPORTED" as const;

/** Error code for model not supporting tool calling. */
export const TOOLS_NOT_SUPPORTED_ERROR_CODE = "TOOLS_NOT_SUPPORTED" as const;

/** Error code for model not supporting advanced reasoning. */
export const REASONING_NOT_SUPPORTED_ERROR_CODE =
  "REASONING_NOT_SUPPORTED" as const;

/** Error code for model not supporting structured output. */
export const STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE =
  "STRUCTURED_OUTPUT_NOT_SUPPORTED" as const;

/** Error code for model sync operation exceeding limits. */
export const MODEL_SYNC_LIMIT_EXCEEDED_ERROR_CODE =
  "MODEL_SYNC_LIMIT_EXCEEDED" as const;

/**
 * Base error for when a model lacks a required capability (vision, tools, reasoning, etc.).
 * Subclassed for specific capability limitations with tailored error messages.
 *
 * @see VisionNotSupportedError for vision capability errors
 * @see ToolsNotSupportedError for tool calling errors
 * @see ReasoningNotSupportedError for reasoning token errors
 * @see StructuredOutputNotSupportedError for structured output errors
 * @author Maruf Bepary
 */
export class ModelCapabilityError extends Error {
  readonly code: string = MODEL_CAPABILITY_ERROR_CODE;

  constructor(message = "The selected model lacks a required capability") {
    super(message);
    this.name = "ModelCapabilityError";
  }
}

/**
 * Error thrown when attempting to use vision/image analysis with a model that does not support it.
 * Thrown when attachments with images are sent to a non-vision model.
 *
 * @see ModelCapabilityError for base capability error
 * @author Maruf Bepary
 */
export class VisionNotSupportedError extends ModelCapabilityError {
  override readonly code = VISION_NOT_SUPPORTED_ERROR_CODE;

  constructor(
    message = "The selected model does not support vision/image analysis.",
  ) {
    super(message);
    this.name = "VisionNotSupportedError";
  }
}

/**
 * Error thrown when attempting to call tools/functions with a model that does not support them.
 * Thrown when MCP tools or function calling is attempted with incompatible models.
 *
 * @see ModelCapabilityError for base capability error
 * @author Maruf Bepary
 */
export class ToolsNotSupportedError extends ModelCapabilityError {
  override readonly code = TOOLS_NOT_SUPPORTED_ERROR_CODE;

  constructor(message = "The selected model does not support tool calling.") {
    super(message);
    this.name = "ToolsNotSupportedError";
  }
}

/**
 * Error thrown when attempting to use extended thinking/reasoning with an incompatible model.
 * Thrown when reasoning tokens are requested from models that do not support them.
 *
 * @see ModelCapabilityError for base capability error
 * @author Maruf Bepary
 */
export class ReasoningNotSupportedError extends ModelCapabilityError {
  override readonly code = REASONING_NOT_SUPPORTED_ERROR_CODE;

  constructor(
    message = "The selected model does not support advanced reasoning tokens.",
  ) {
    super(message);
    this.name = "ReasoningNotSupportedError";
  }
}

/**
 * Error thrown when attempting to use structured output/schema with an incompatible model.
 * Thrown when schema-based response formatting is requested from models that do not support it.
 *
 * @see ModelCapabilityError for base capability error
 * @author Maruf Bepary
 */
export class StructuredOutputNotSupportedError extends ModelCapabilityError {
  override readonly code = STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE;

  constructor(
    message = "The selected model does not support schema-based structured output.",
  ) {
    super(message);
    this.name = "StructuredOutputNotSupportedError";
  }
}

/** Error code for attachment submitted to non-vision model. */
export const ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE =
  "ATTACHMENT_VISION_UNSUPPORTED" as const;

/** Error code for duplicate model detected during import. */
export const MODEL_DUPLICATE_IMPORT_ERROR_CODE =
  "MODEL_DUPLICATE_IMPORT" as const;

/** Error code for RAG extraction producing no content. */
export const RAG_EXTRACTION_EMPTY_ERROR_CODE = "RAG_EXTRACTION_EMPTY" as const;

/**
 * Error thrown when an image attachment is submitted to a model that does not support vision.
 * Prompts user to switch to a vision-capable model for image analysis.
 *
 * @author Maruf Bepary
 */
export class AttachmentVisionUnsupportedError extends Error {
  readonly code = ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE;

  constructor(
    message = "The selected model does not support image analysis. Please switch to a vision-enabled model.",
  ) {
    super(message);
    this.name = "AttachmentVisionUnsupportedError";
  }
}

/**
 * Error thrown when a model sync/import operation exceeds configured limits.
 * Prevents excessive API calls or data transfers during bulk model operations.
 *
 * @author Maruf Bepary
 */
export class ModelSyncLimitExceededError extends Error {
  readonly code = MODEL_SYNC_LIMIT_EXCEEDED_ERROR_CODE;

  constructor(
    message = "The model sync operation has exceeded the maximum limit",
  ) {
    super(message);
    this.name = "ModelSyncLimitExceededError";
  }
}

/**
 * Error thrown when importing models that already exist in the user's provider registry.
 * Includes count and IDs of duplicates, allowing user to force overwrite if desired.
 * Used in model import/sync flows to prevent silent overwrites.
 *
 * @author Maruf Bepary
 */
export class ModelDuplicateImportError extends Error {
  readonly code = MODEL_DUPLICATE_IMPORT_ERROR_CODE;
  readonly duplicateCount: number;
  readonly duplicateModelIds: string[];

  constructor(
    duplicateCount: number,
    duplicateModelIds: string[],
    message = `${duplicateCount} model(s) skipped (already exist). Force import to overwrite?`,
  ) {
    super(message);
    this.name = "ModelDuplicateImportError";
    this.duplicateCount = duplicateCount;
    this.duplicateModelIds = duplicateModelIds;
  }
}

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

/**
 * Generic error thrown when a requested resource is not found in the database.
 * Used for 404-equivalent errors when querying entities like chats, projects, etc.
 *
 * @author Maruf Bepary
 */
export class NotFoundError extends Error {
  readonly code: string = "NOT_FOUND";

  constructor(message?: string) {
    super(message ?? "Not Found");
    this.name = "NotFoundError";
  }
}

/**
 * Checks if a given error message corresponds to a missing API key.
 *
 * @param message - The error message to check
 * @returns True if the message is the standardized API key error
 */
export function isApiKeyError(message: string): boolean {
  return (
    message === MISSING_API_KEY_ERROR ||
    message.includes("No AI provider") ||
    message.includes("provider/model configured")
  );
}
