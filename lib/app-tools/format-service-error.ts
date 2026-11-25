import type { CommonError } from "@/types/error/common-error";

/**
 * Formats a `CommonError` from a `*ForUser` service into a uniform tool
 * failure payload for model self-correction.
 */
export function toToolFailure(error: CommonError): {
  success: false;
  error: string;
  issues?: readonly string[];
} {
  return {
    success: false,
    error: error.message,
    ...("issues" in error && error.issues ? { issues: error.issues } : {}),
  };
}
