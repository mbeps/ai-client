import { Inbox } from "lucide-react";

/**
 * Props for the EmptyState component.
 *
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
 */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="bg-muted/20 text-muted-foreground col-span-full rounded-lg border border-dashed py-12 text-center">
      <Inbox className="mx-auto mb-4 h-10 w-10 opacity-20" />
      <p className="mx-auto max-w-[250px] text-sm">{message}</p>
    </div>
  );
}
