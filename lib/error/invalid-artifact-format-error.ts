const INVALID_ARTIFACT_FORMAT_ERROR_CODE = "INVALID_ARTIFACT_FORMAT";

/**
 * Thrown when an artifact cannot be parsed or transformed into a valid format (e.g. empty spreadsheet).
 *
 * @author Maruf Bepary
 */
export class InvalidArtifactFormatError extends Error {
  readonly code = INVALID_ARTIFACT_FORMAT_ERROR_CODE;
  readonly status = 400;

  constructor(
    message = "Artifact content could not be parsed into valid format",
  ) {
    super(message);
    this.name = "InvalidArtifactFormatError";
  }
}
