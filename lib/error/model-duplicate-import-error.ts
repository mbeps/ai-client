import { MODEL_DUPLICATE_IMPORT_ERROR_CODE } from "@/lib/error/model-duplicate-import-error-code";

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
