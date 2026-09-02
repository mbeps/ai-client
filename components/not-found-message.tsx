import { FileQuestion } from "lucide-react";

/**
 * Props for the NotFoundMessage component.
 *
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
 */
export function NotFoundMessage({ entity }: NotFoundMessageProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 py-12 text-muted-foreground">
      <FileQuestion className="mb-4 h-10 w-10 opacity-20" />
      <p className="font-medium text-lg">{entity} not found</p>
    </div>
  );
}
