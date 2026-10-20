"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface JobsOfflineBannerProps {
  offline: boolean;
  loading: boolean;
  onRetry: () => void;
}

/**
 * Warning banner displayed when the background Inngest engine is offline.
 */
export function JobsOfflineBanner({
  offline,
  loading,
  onRetry,
}: JobsOfflineBannerProps) {
  if (!offline) return null;

  return (
    <Alert
      variant="warning"
      className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
    >
      <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            Inngest Engine Offline
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Cannot connect to Inngest background engine. Active runs may not
            update in real-time until connection is restored.
          </AlertDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={loading}
          className="mt-2 shrink-0 bg-white sm:mt-0 dark:bg-zinc-900"
        >
          <RefreshCw
            className={cn("mr-1.5 size-3.5", loading && "animate-spin")}
          />
          Retry
        </Button>
      </div>
    </Alert>
  );
}
