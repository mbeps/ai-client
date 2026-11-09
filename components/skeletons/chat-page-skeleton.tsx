import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton screen for chat interface routes (/chats/[id], project and assistant chats).
 * Emulates the conversation header, alternating message bubbles, and bottom composer.
 *
 * @author Maruf Bepary
 */
export function ChatPageSkeleton() {
  return (
    <div
      data-testid="chat-page-skeleton"
      className="bg-background flex h-full w-full flex-col overflow-hidden"
    >
      {/* Chat Top Controls Placeholder */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>

      {/* Message Stream Area */}
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 overflow-hidden p-4 md:p-6">
        {/* User Message (Right) */}
        <div className="flex justify-end">
          <div className="border-border bg-muted/60 w-full max-w-md space-y-2 rounded-2xl border p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>

        {/* Assistant Message (Left) */}
        <div className="flex items-start gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="border-border bg-card w-full max-w-xl space-y-3 rounded-2xl border p-4 shadow-xs">
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>

        {/* User Message 2 (Right) */}
        <div className="flex justify-end">
          <div className="border-border bg-muted/60 w-full max-w-xs space-y-2 rounded-2xl border p-4">
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>

      {/* Bottom Composer Placeholder */}
      <div className="mx-auto w-full max-w-3xl shrink-0 p-4">
        <div className="border-border bg-card flex h-28 flex-col justify-between rounded-2xl border p-3 shadow-xs">
          <Skeleton className="h-4 w-60" />
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="size-8 rounded-md" />
            </div>
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
