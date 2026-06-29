import { Loader2Icon } from "lucide-react";
import { ReactNode, Suspense } from "react";

/**
 * Suspense boundary with a centered spinner fallback for async profile tab content.
 * Wraps server components that fetch user data (passkeys, sessions, etc.).
 *
 * @author Maruf Bepary
 */
export function LoadingSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Loader2Icon className="size-20 animate-spin" />}>
      {children}
    </Suspense>
  );
}
