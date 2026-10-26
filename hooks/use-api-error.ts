import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { toast } from "sonner";
import { ROUTES } from "@/config/routes";
import { ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE } from "@/lib/error/attachment-vision-unsupported-error-code";
import { isApiKeyError } from "@/lib/error/is-api-key-error";
import { MODEL_DUPLICATE_IMPORT_ERROR_CODE } from "@/lib/error/model-duplicate-import-error-code";
import { MODEL_MALFORMED_ID_ERROR_CODE } from "@/lib/error/model-malformed-id-error-code";
import { PROVIDER_NOT_CONFIGURED_ERROR_CODE } from "@/lib/error/provider-not-configured-error-code";
import { RAG_EXTRACTION_EMPTY_ERROR_CODE } from "@/lib/error/rag-extraction-empty-error-code";
import { RATE_LIMIT_ERROR_CODE } from "@/lib/error/rate-limit-error-code";
import { TOOLS_NOT_SUPPORTED_ERROR_CODE } from "@/lib/error/tools-not-supported-error-code";
import { UNAUTHORIZED_ERROR_CODE } from "@/lib/error/unauthorized-error-code";
import { UNAUTHORIZED_ERROR_MESSAGE } from "@/lib/error/unauthorized-error-message";
import { VISION_NOT_SUPPORTED_ERROR_CODE } from "@/lib/error/vision-not-supported-error-code";

interface ExtractedErrorInfo {
  code?: string;
  message: string;
  raw: Record<string, any> | null;
}

interface StaticToastConfig {
  type: "error" | "warning";
  title: string;
  description: string;
}

type DynamicToastHandler = (
  router: { push: (href: string) => void },
  message: string,
  raw: Record<string, any> | null,
) => void;

const STATIC_CODE_TOASTS: Record<string, StaticToastConfig | undefined> = {
  [VISION_NOT_SUPPORTED_ERROR_CODE]: {
    type: "error",
    title: "Vision Not Supported",
    description:
      "The selected model cannot see images. Please switch to a vision-enabled model.",
  },
  [TOOLS_NOT_SUPPORTED_ERROR_CODE]: {
    type: "error",
    title: "Tools Not Supported",
    description:
      "The selected model cannot use tools. Please switch to a model that supports tool calling.",
  },
  [ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE]: {
    type: "error",
    title: "Image Upload Not Supported",
    description:
      "The selected model does not support image analysis. Please switch to a vision-enabled model.",
  },
};

/**
 * Displays error toast for rate limit or credit exhaustion with a provider settings action.
 */
function handleRateLimitToast(
  router: { push: (href: string) => void },
  message: string,
): void {
  const isCredits =
    message.toLowerCase().includes("openrouter") &&
    message.toLowerCase().includes("credits");

  toast.error(isCredits ? "Insufficient Credits" : "Rate Limit Reached", {
    description: message,
    action: {
      label: "View Providers",
      onClick: () => router.push(ROUTES.SETTINGS.PROVIDERS.path),
    },
  });
}

const DYNAMIC_CODE_HANDLERS: Record<string, DynamicToastHandler | undefined> = {
  [MODEL_DUPLICATE_IMPORT_ERROR_CODE]: (_router, _message, raw) => {
    const duplicateCount = raw?.duplicateCount ?? "some";
    toast.warning(`${duplicateCount} model(s) skipped (already exist)`, {
      description: "These models will be skipped during import.",
    });
  },
  [MODEL_MALFORMED_ID_ERROR_CODE]: (_router, _message, raw) => {
    const invalidCount = raw?.invalidCount ?? "some";
    toast.warning(`${invalidCount} model(s) skipped (malformed ID)`, {
      description:
        "Models with missing or invalid IDs were excluded from sync.",
    });
  },
  [RATE_LIMIT_ERROR_CODE]: handleRateLimitToast,
  [UNAUTHORIZED_ERROR_CODE]: (router) => {
    toast.error("Session Expired", {
      description: UNAUTHORIZED_ERROR_MESSAGE,
      action: {
        label: "Log In",
        onClick: () => router.push(ROUTES.AUTH.LOGIN.path),
      },
    });
  },
  [PROVIDER_NOT_CONFIGURED_ERROR_CODE]: (router) => {
    toast.error("No AI Providers Configured", {
      description:
        "Please set up an AI provider and enable at least one model to start chatting.",
      action: {
        label: "Set up Providers",
        onClick: () => router.push(ROUTES.SETTINGS.PROVIDERS.path),
      },
    });
  },
  [RAG_EXTRACTION_EMPTY_ERROR_CODE]: (_router, message) => {
    toast.error("Empty Document", { description: message });
  },
};

/**
 * Resolves message text from a plain error object.
 */
function resolveObjectErrorMessage(
  raw: Record<string, any>,
  fallback: string,
): string {
  return raw.error || raw.message || fallback;
}

/**
 * Normalizes error code, message, and original payload from an unknown error value.
 */
function extractErrorInfo(
  error: unknown,
  fallbackMessage?: string,
): ExtractedErrorInfo {
  const fallback = fallbackMessage ?? "An error occurred";

  if (error instanceof Error) {
    return {
      code: (error as any).code,
      message: error.message,
      raw: error as any,
    };
  }

  if (typeof error === "string") {
    return { message: error, raw: null };
  }

  if (error && typeof error === "object") {
    const raw = error as Record<string, any>;
    return {
      code: raw.code,
      message: resolveObjectErrorMessage(raw, fallback),
      raw,
    };
  }

  return { message: fallback, raw: null };
}

/**
 * Handles parameterized error codes requiring dynamic messages, counts, or router actions.
 */
function handleDynamicCodeToast(
  code: string,
  message: string,
  raw: Record<string, any> | null,
  router: { push: (href: string) => void },
): boolean {
  const handler = DYNAMIC_CODE_HANDLERS[code];
  if (!handler) {
    return false;
  }
  handler(router, message, raw);
  return true;
}

/**
 * Centralises API error handling with feature-specific error codes and user feedback.
 * Detects capability errors (vision, tools, reasoning, structured output),
 * model sync limits, API key errors, rate limits, and authorization failures.
 * Automatically shows toast notifications with actionable guidance.
 *
 * Side effects: Displays toast notifications, navigates to settings on API key error.
 *
 * @returns Object with handleApiError method for processing API error responses.
 * @throws No exceptions thrown; errors are handled and returned as boolean flags.
 * @see useEntityOptions for entity mutation error handling.
 * @see https://sonner.emilkowal.ski for toast notification patterns.
 * @author Maruf Bepary
 */
export function useApiError() {
  const router = useRouter();

  /**
   * Checks if an error is a recognized API/capability/key error and shows an appropriate toast.
   *
   * @param error - The error object or message string to check.
   * @param fallbackMessage - Optional message to show if error is not handled by specific code.
   * @returns True if the error was handled as a recognized API/code error, false otherwise.
   */
  const handleApiError = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      const { code, message, raw } = extractErrorInfo(error, fallbackMessage);

      if (code) {
        const staticToast = STATIC_CODE_TOASTS[code];
        if (staticToast) {
          toast[staticToast.type](staticToast.title, {
            description: staticToast.description,
          });
          return true;
        }

        if (handleDynamicCodeToast(code, message, raw, router)) {
          return true;
        }
      }

      if (isApiKeyError(message)) {
        toast.error(message, {
          action: {
            label: "Go to Settings",
            onClick: () => router.push(ROUTES.SETTINGS.APP.path),
          },
        });
        return true;
      }

      if (fallbackMessage) {
        toast.error(fallbackMessage);
      }

      return false;
    },
    [router],
  );

  return { handleApiError };
}
