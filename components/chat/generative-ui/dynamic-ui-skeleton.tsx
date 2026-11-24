"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Streaming placeholder shown while a ```spec / ```ui fence is still open,
 * preventing raw partial JSON from flashing in the chat thread.
 */
export function DynamicUISkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("not-typeset my-3 w-full", className)}>
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-40" />
          <span className="text-muted-foreground animate-pulse text-xs">
            Building interactive UI...
          </span>
        </div>
        <Skeleton className="h-3.5 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-36 w-full" />
      </CardContent>
    </Card>
  );
}
