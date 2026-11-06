"use client";

import { Home, RotateCcw } from "lucide-react";
import { ErrorPage } from "@/components/shared/error-page";

/**
 * Root global error boundary for uncaught exceptions in root layout.
 * Replaces the entire HTML document on catastrophic failure.
 *
 * @param props - Component error state and recovery callback
 * @returns Full HTML document with error UI
 * @author Maruf Bepary
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background min-h-screen font-sans antialiased">
        <ErrorPage
          error={error}
          reset={reset}
          heading="Something went wrong"
          fallbackDescription="A critical application error occurred. Please try reloading."
          linkHref="/"
          linkLabel="Go home"
          linkIcon={Home}
          resetIcon={RotateCcw}
        />
      </body>
    </html>
  );
}
