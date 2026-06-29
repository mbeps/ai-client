"use client";

import { ErrorPage } from "@/components/shared/error-page";

/**
 * Chat page error boundary: Graceful error handling for failed chat loads.
 *
 * Displays error message when chat fails to load (database error, auth failure, etc).
 * Provides reset button to retry and link back to chat list. Uses shared ErrorPage layout.
 *
 * @author Maruf Bepary
 */
export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      heading="Failed to load chat"
      fallbackDescription="This chat could not be loaded. Please try again."
      linkHref="/chats"
      linkLabel="Back to chats"
    />
  );
}
