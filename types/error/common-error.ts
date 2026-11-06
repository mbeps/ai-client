import type { ERROR_CODE } from "@/lib/error/error-code";

/**
 * Common application error shapes across domain boundaries.
 *
 * @author Maruf Bepary
 */
export type CommonError =
  | { readonly code: typeof ERROR_CODE.UNAUTHORIZED; readonly message: string }
  | { readonly code: typeof ERROR_CODE.NOT_FOUND; readonly message: string }
  | { readonly code: typeof ERROR_CODE.FORBIDDEN; readonly message: string }
  | {
      readonly code: typeof ERROR_CODE.RATE_LIMIT;
      readonly message: string;
      readonly retryAfterSeconds?: number;
    }
  | {
      readonly code: typeof ERROR_CODE.INVALID_INPUT;
      readonly message: string;
      readonly issues?: readonly string[];
    }
  | { readonly code: typeof ERROR_CODE.CONFLICT; readonly message: string }
  | {
      readonly code: typeof ERROR_CODE.INTERNAL;
      readonly message: string;
      readonly ref: string;
    };
