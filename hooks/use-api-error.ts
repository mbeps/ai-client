import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  isApiKeyError,
  VISION_NOT_SUPPORTED_ERROR_CODE,
  TOOLS_NOT_SUPPORTED_ERROR_CODE,
  REASONING_NOT_SUPPORTED_ERROR_CODE,
  STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE,
  ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE,
  MODEL_SYNC_LIMIT_EXCEEDED_ERROR_CODE,
  MODEL_DUPLICATE_IMPORT_ERROR_CODE,
  MODEL_MALFORMED_ID_ERROR_CODE,
  RAG_EXTRACTION_EMPTY_ERROR_CODE,
  PROVIDER_NOT_CONFIGURED_ERROR_CODE,
  RATE_LIMIT_ERROR_CODE,
  UNAUTHORIZED_ERROR_CODE,
  UNAUTHORIZED_ERROR_MESSAGE,
} from "@/lib/constants/errors";
import { ROUTES } from "@/constants/routes";

/**
 * Hook to handle API-related errors consistently across the application.
 * Specifically detects missing API key errors and provides a shortcut to settings.
 *
 * @returns Object containing error handling methods.
 */
export function useApiError() {
  const router = useRouter();

  /**
   * Checks if an error is a missing API key error and shows a toast with a settings link.
   *
   * @param error - The error object or message string to check.
   * @param fallbackMessage - Optional message to show if error is not an API key error (optional).
   * @returns True if the error was handled as an API key error, false otherwise.
   */
  const handleApiError = (error: unknown, fallbackMessage?: string) => {
    // Extract code and message from various error formats
    let code: string | undefined;
    let message: string;

    if (error instanceof Error) {
      message = error.message;
      code = (error as any).code;
    } else if (typeof error === "string") {
      message = error;
    } else if (error && typeof error === "object") {
      message =
        (error as any).error ||
        (error as any).message ||
        (fallbackMessage ?? "An error occurred");
      code = (error as any).code;
    } else {
      message = fallbackMessage ?? "An error occurred";
    }

    // Handle specific capability error codes
    if (code === VISION_NOT_SUPPORTED_ERROR_CODE) {
      toast.error("Vision Not Supported", {
        description:
          "The selected model cannot see images. Please switch to a vision-enabled model.",
      });
      return true;
    }

    if (code === TOOLS_NOT_SUPPORTED_ERROR_CODE) {
      toast.error("Tools Not Supported", {
        description:
          "The selected model cannot use tools. Please switch to a model that supports tool calling.",
      });
      return true;
    }

    if (code === REASONING_NOT_SUPPORTED_ERROR_CODE) {
      toast.error("Reasoning Not Supported", {
        description:
          "The selected model does not support advanced reasoning tokens. Please use a different model.",
      });
      return true;
    }

    if (code === STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE) {
      toast.error("Structured Output Not Supported", {
        description:
          "The selected model does not support schema-based structured output. Please use a different model.",
      });
      return true;
    }

    if (code === MODEL_SYNC_LIMIT_EXCEEDED_ERROR_CODE) {
      toast.warning("Model Limit Reached", {
        description:
          "Provider returned more than 1,000 models. Displaying the first 1,000 available models.",
      });
      return true;
    }

    if (code === MODEL_DUPLICATE_IMPORT_ERROR_CODE) {
      const duplicateCount = (error as any).duplicateCount ?? "some";
      toast.warning(`${duplicateCount} model(s) skipped (already exist)`, {
        description: "These models will be skipped during import.",
      });
      return true;
    }

    if (code === RATE_LIMIT_ERROR_CODE) {
      const isOpenRouterCredits =
        message.toLowerCase().includes("openrouter") &&
        message.toLowerCase().includes("credits");

      toast.error(
        isOpenRouterCredits ? "Insufficient Credits" : "Rate Limit Reached",
        {
          description: message,
          action: {
            label: "View Providers",
            onClick: () => router.push(ROUTES.SETTINGS.PROVIDERS.path),
          },
        },
      );
      return true;
    }

    if (code === UNAUTHORIZED_ERROR_CODE) {
      toast.error("Session Expired", {
        description: UNAUTHORIZED_ERROR_MESSAGE,
        action: {
          label: "Log In",
          onClick: () => router.push(ROUTES.AUTH.LOGIN.path),
        },
      });
      return true;
    }

    if (code === MODEL_MALFORMED_ID_ERROR_CODE) {
      const invalidCount = (error as any).invalidCount ?? "some";
      toast.warning(`${invalidCount} model(s) skipped (malformed ID)`, {
        description:
          "Models with missing or invalid IDs were excluded from sync.",
      });
      return true;
    }

    if (code === ATTACHMENT_VISION_UNSUPPORTED_ERROR_CODE) {
      toast.error("Image Upload Not Supported", {
        description:
          "The selected model does not support image analysis. Please switch to a vision-enabled model.",
      });
      return true;
    }

    if (code === RAG_EXTRACTION_EMPTY_ERROR_CODE) {
      toast.error("Empty Document", {
        description: message,
      });
      return true;
    }

    if (code === PROVIDER_NOT_CONFIGURED_ERROR_CODE) {
      toast.error("No AI Providers Configured", {
        description:
          "Please set up an AI provider and enable at least one model to start chatting.",
        action: {
          label: "Set up Providers",
          onClick: () => router.push(ROUTES.SETTINGS.PROVIDERS.path),
        },
      });
      return true;
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

    if (fallbackMessage && !isApiKeyError(message)) {
      toast.error(fallbackMessage);
    }

    return false;
  };

  return { handleApiError };
}
