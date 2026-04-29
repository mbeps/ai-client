"use client";

import { ErrorPage } from "@/components/shared/error-page";

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
