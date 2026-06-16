import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  isApiKeyError,
  VISION_NOT_SUPPORTED_ERROR_CODE,
  TOOLS_NOT_SUPPORTED_ERROR_CODE,
  REASONING_NOT_SUPPORTED_ERROR_CODE,
  STRUCTURED_OUTPUT_NOT_SUPPORTED_ERROR_CODE,
} from "@/lib/constants/errors";
import { ROUTES } from "@/constants/routes";

/**
 * Hook to handle API-related errors consistently across the application.
 * Specifically detects missing API key errors and provides a shortcut to settings.
 *
 * @returns Object containing error handling methods.
 * @author Maruf Bepary
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
