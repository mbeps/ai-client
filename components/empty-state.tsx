import { Inbox } from "lucide-react";

/**
 * Props for the EmptyState component.
 *
 * @author Maruf Bepary
 */
interface EmptyStateProps {
  /** Human-readable message to display when the list is empty. */
  message: string;
}

/**
 * Placeholder rendered inside a grid when there are no items to display.
 * Spans all columns via `col-span-full` and shows a dashed border to indicate the empty region.
 *
 * @param props.message - Text to show inside the empty state container.
 * @author Maruf Bepary
 */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
      <Inbox className="h-10 w-10 mx-auto mb-4 opacity-20" />
      <p className="max-w-[250px] mx-auto text-sm">{message}</p>
    </div>
  );
}
