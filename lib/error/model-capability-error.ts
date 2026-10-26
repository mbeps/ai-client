import { MODEL_CAPABILITY_ERROR_CODE } from "@/lib/error/model-capability-error-code";

/**
 * Base error for when a model lacks a required capability (vision, tools, reasoning, etc.).
 * Subclassed for specific capability limitations with tailored error messages.
 *
 * @see VisionNotSupportedError for vision capability errors
 * @see ToolsNotSupportedError for tool calling errors
 * @author Maruf Bepary
 */
export class ModelCapabilityError extends Error {
  readonly code: string = MODEL_CAPABILITY_ERROR_CODE;

  constructor(message = "The selected model lacks a required capability") {
    super(message);
    this.name = "ModelCapabilityError";
  }
}
