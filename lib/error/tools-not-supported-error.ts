import { ModelCapabilityError } from "@/lib/error/model-capability-error";
import { TOOLS_NOT_SUPPORTED_ERROR_CODE } from "@/lib/error/tools-not-supported-error-code";

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
