import { unstable_rethrow } from "next/navigation";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import type { AppError } from "@/types/error/app-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions"]);

function generateErrorRef(): string {
  return crypto.randomUUID().slice(0, 8);
}

export type ActionHandler<
  TArgs extends readonly unknown[],
  TResult,
  TError extends AppError,
> = (...args: TArgs) => Promise<Result<TResult, TError>>;

export type ActionError<TError extends AppError> =
  | TError
  | { readonly code: typeof ERROR_CODE.UNAUTHORIZED; readonly message: string }
  | {
      readonly code: typeof ERROR_CODE.INTERNAL;
      readonly message: string;
      readonly ref: string;
    };

/**
 * Higher-order function wrapping Server Actions to ensure all expected and unexpected errors
 * cross the boundary as typed Result values instead of masked digests.
 *
 * @param handler - The asynchronous action function returning a Result
 * @returns Wrapped action function guaranteed to return a Result
 * @author Maruf Bepary
 */
export function defineAction<
  TArgs extends readonly unknown[],
  TResult,
  TError extends AppError = AppError,
>(
  handler: ActionHandler<TArgs, TResult, TError>,
): (...args: TArgs) => Promise<Result<TResult, ActionError<TError>>> {
  return async (
    ...args: TArgs
  ): Promise<Result<TResult, ActionError<TError>>> => {
    try {
      return await handler(...args);
    } catch (error: unknown) {
      unstable_rethrow(error);

      if (
        (error instanceof AppException &&
          error.error.code === ERROR_CODE.UNAUTHORIZED) ||
        (error instanceof Error && error.message === "Unauthorized")
      ) {
        return fail({
          code: ERROR_CODE.UNAUTHORIZED,
          message: "Unauthorized",
        } as ActionError<TError>);
      }

      const ref = generateErrorRef();
      const isUnconvertedAppException = error instanceof AppException;

      log.error(
        isUnconvertedAppException
          ? "Unconverted AppException caught at Server Action boundary (ref: {ref}, code: {code}): {error}"
          : "Unhandled exception in Server Action (ref: {ref}): {error}",
        {
          ref,
          code: isUnconvertedAppException ? error.error.code : undefined,
          error:
            error instanceof Error ? (error.stack ?? error.message) : error,
        },
      );

      return fail({
        code: ERROR_CODE.INTERNAL,
        message: `Something went wrong. (Ref: ${ref})`,
        ref,
      } as ActionError<TError>);
    }
  };
}
