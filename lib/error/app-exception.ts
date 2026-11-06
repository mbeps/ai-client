import type { AppError } from "@/types/error/app-error";
import type { CommonError } from "@/types/error/common-error";

/**
 * Exception class used exclusively for unwinding internal boundaries (e.g. database transactions)
 * before conversion to a Result object. Never leaked across Server Actions or Inngest boundaries.
 *
 * @author Maruf Bepary
 */
export class AppException<E extends AppError = CommonError> extends Error {
  readonly error: E;

  get code(): string {
    return this.error.code;
  }

  constructor(error: E) {
    super(error.message);
    this.name = "AppException";
    this.error = error;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
