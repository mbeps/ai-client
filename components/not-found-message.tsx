import { FileQuestion } from "lucide-react";

/**
 * Props for the NotFoundMessage component.
 *
 * @author Maruf Bepary
 */
interface NotFoundMessageProps {
  /** Name of the entity that was not found (e.g. "Chat", "Project"). */
  entity: string;
}

/**
 * Minimal inline message shown when a requested entity cannot be found.
 * Used on detail pages when the Zustand store does not contain the given ID.
 *
 * @param props.entity - The entity type name to include in the message.
 * @author Maruf Bepary
 */
export function NotFoundMessage({ entity }: NotFoundMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
      <FileQuestion className="h-10 w-10 mb-4 opacity-20" />
      <p className="text-lg font-medium">{entity} not found</p>
    </div>
  );
}
