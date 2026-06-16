/**
 * Standard error message for missing OpenRouter API key.
 * Used across the application to identify and handle API configuration issues.
 */
export const MISSING_API_KEY_ERROR =
  "OpenRouter API key not found. Please add your key in Settings > App.";

export const PROVIDER_NOT_CONFIGURED_ERROR_CODE =
  "PROVIDER_NOT_CONFIGURED" as const;

export const PROVIDER_KEY_CORRUPTED_ERROR_CODE =
  "PROVIDER_KEY_CORRUPTED" as const;

export const DIMENSION_MISMATCH_ERROR_CODE = "DIMENSION_MISMATCH" as const;

export class ProviderNotConfiguredError extends Error {
  readonly code = PROVIDER_NOT_CONFIGURED_ERROR_CODE;

  constructor(message = "No AI provider/model configured for this request") {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderKeyCorruptedError extends Error {
  readonly code = PROVIDER_KEY_CORRUPTED_ERROR_CODE;

  constructor(message = "Provider credentials are invalid or corrupted") {
    super(message);
    this.name = "ProviderKeyCorruptedError";
  }
}

export class DimensionMismatchError extends Error {
  readonly code = DIMENSION_MISMATCH_ERROR_CODE;

  constructor(
    message = "Embedding dimensions do not match expected vector size",
  ) {
    super(message);
    this.name = "DimensionMismatchError";
  }
}

export const MODEL_CAPABILITY_ERROR_CODE = "MODEL_CAPABILITY_ERROR" as const;
export const VISION_NOT_SUPPORTED_ERROR_CODE = "VISION_NOT_SUPPORTED" as const;
export const TOOLS_NOT_SUPPORTED_ERROR_CODE = "TOOLS_NOT_SUPPORTED" as const;
export const REASONING_NOT_SUPPORTED_ERROR_CODE =
  "REASONING_NOT_SUPPORTED" as const;
export const STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE =
  "STRUCTURED_OUTPUT_NOT_SUPPORTED" as const;

export class ModelCapabilityError extends Error {
  readonly code: string = MODEL_CAPABILITY_ERROR_CODE;

  constructor(message = "The selected model lacks a required capability") {
    super(message);
    this.name = "ModelCapabilityError";
  }
}

export class VisionNotSupportedError extends ModelCapabilityError {
  override readonly code = VISION_NOT_SUPPORTED_ERROR_CODE;

  constructor(
    message = "The selected model does not support vision/image analysis.",
  ) {
    super(message);
    this.name = "VisionNotSupportedError";
  }
}

export class ToolsNotSupportedError extends ModelCapabilityError {
  override readonly code = TOOLS_NOT_SUPPORTED_ERROR_CODE;

  constructor(message = "The selected model does not support tool calling.") {
    super(message);
    this.name = "ToolsNotSupportedError";
  }
}

export class ReasoningNotSupportedError extends ModelCapabilityError {
  override readonly code = REASONING_NOT_SUPPORTED_ERROR_CODE;

  constructor(
    message = "The selected model does not support advanced reasoning tokens.",
  ) {
    super(message);
    this.name = "ReasoningNotSupportedError";
  }
}

export class StructuredOutputNotSupportedError extends ModelCapabilityError {
  override readonly code = STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE;

  constructor(
    message = "The selected model does not support schema-based structured output.",
  ) {
    super(message);
    this.name = "StructuredOutputNotSupportedError";
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
