import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isApiKeyError } from "@/lib/constants/errors";
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
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : (fallbackMessage ?? "An error occurred");

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
