import { ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE } from "@/lib/error/attachment-vision-unsupported-error-code";

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
