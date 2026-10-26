import { CONTEXT_WINDOW_EXCEEDED_ERROR_CODE } from "@/lib/error/context-window-exceeded-error-code";

/**
 * Error thrown when the request exceeds the model's context window.
 * Mapped from provider errors mentioning context length limits (HTTP 400).
 *
 * @author Maruf Bepary
 */
export class ContextWindowExceededError extends Error {
  readonly code = CONTEXT_WINDOW_EXCEEDED_ERROR_CODE;
  readonly status = 400;

  constructor(
    message = "This conversation is too long for the selected model. Start a new chat or use a model with a larger context window.",
  ) {
    super(message);
    this.name = "ContextWindowExceededError";
  }
}
