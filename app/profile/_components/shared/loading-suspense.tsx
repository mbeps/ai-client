import { Loader2Icon } from "lucide-react";
import { ReactNode, Suspense } from "react";

/**
 * Suspense boundary with a subtle loading indicator for tab panels.
 * @param children Lazy content to render when data is resolved.
 * @returns Suspense wrapper with a spinning loader fallback.
 * @author Maruf Bepary
 */
export function LoadingSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loader2Icon className="size-20 animate-spin" />}>
      {children}
    </Suspense>
  );
}
