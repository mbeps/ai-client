import { type ReactNode, Suspense } from "react";
import { TableListSkeleton } from "@/components/skeletons/table-list-skeleton";

/**
 * Suspense boundary with a skeleton fallback for async profile tab content.
 * Wraps server components that fetch user data (passkeys, sessions, linked accounts).
 *
 * @author Maruf Bepary
 */
export function LoadingSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<TableListSkeleton rows={3} />}>{children}</Suspense>
  );
}
