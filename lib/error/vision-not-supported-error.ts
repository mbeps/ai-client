import { ModelCapabilityError } from "@/lib/error/model-capability-error";
import { VISION_NOT_SUPPORTED_ERROR_CODE } from "@/lib/error/vision-not-supported-error-code";

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
