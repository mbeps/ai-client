import { MODEL_MALFORMED_ID_ERROR_CODE } from "@/lib/error/model-malformed-id-error-code";

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
