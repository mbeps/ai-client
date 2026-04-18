import { cn } from "@/lib/utils";
import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Overlays a spinner over content without causing layout shift.
 * Both layers occupy the same CSS grid cell; visibility is toggled so the
 * button maintains its original width during async operations.
 *
 * @param props.isLoading - When `true`, hides children and shows the spinner
 * @param props.children - Content rendered when not in a loading state
 * @param props.className - Additional classes applied to both overlay layers
 * @author Maruf Bepary
 */
export function LoadingSwap({
  isLoading,
  children,
  className,
}: {
  isLoading: boolean;
  children: ReactNode;
  className?: string;
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
  );
}
