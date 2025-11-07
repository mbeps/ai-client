import { cn } from "@/lib/utils"
import { Loader2Icon } from "lucide-react"
import type { ReactNode } from "react"

/**
 * Swaps between children and a spinner without shifting layout.
 * @param isLoading Whether to display the loading spinner.
 * @param children Content that appears when not loading.
 * @param className Optional class names applied to both layers.
 * @returns Wrapper that toggles visibility for loading states.
 */
export function LoadingSwap({
  isLoading,
  children,
  className,
}: {
  isLoading: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className="grid grid-cols-1 items-center justify-items-center">
      <div
        className={cn(
          "col-start-1 col-end-2 row-start-1 row-end-2 w-full",
          isLoading ? "invisible" : "visible",
          className,
        )}
      >
        {children}
      </div>
      <div
        className={cn(
          "col-start-1 col-end-2 row-start-1 row-end-2",
          isLoading ? "visible" : "invisible",
          className,
        )}
      >
        <Loader2Icon className="animate-spin" />
      </div>
    </div>
  )
}
