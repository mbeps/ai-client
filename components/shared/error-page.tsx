"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  heading: string;
  fallbackDescription: string;
  linkHref: string;
  linkLabel: string;
  linkIcon?: LucideIcon;
  resetIcon?: LucideIcon;
}

/**
 * Shared full-page error boundary UI for Next.js error.tsx files.
 * Logs the error to console, shows heading, dynamic error message with fallback,
 * optional error digest, a "Try again" button, and a back-navigation link.
 *
 * @param error - Next.js error boundary error object
 * @param reset - Next.js error boundary reset function
 * @param heading - Primary heading text (e.g. "Failed to load chat")
 * @param fallbackDescription - Description shown when error.message is empty
 * @param linkHref - href for the back navigation button
 * @param linkLabel - Label text for the back navigation button
 * @param linkIcon - Optional Lucide icon component for the back navigation button
 * @param resetIcon - Optional Lucide icon component for the "Try again" button
 */
export function ErrorPage({
  error,
  reset,
  heading,
  fallbackDescription,
  linkHref,
  linkLabel,
  linkIcon: LinkIcon,
  resetIcon: ResetIcon,
}: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-xl font-semibold">{heading}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {error.message || fallbackDescription}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>
          {ResetIcon && <ResetIcon className="mr-2 h-4 w-4" />}
          Try again
        </Button>
        <Button asChild variant="ghost">
          <Link href={linkHref}>
            {LinkIcon && <LinkIcon className="mr-2 h-4 w-4" />}
            {linkLabel}
          </Link>
        </Button>
      </div>
    </div>
  );
}
