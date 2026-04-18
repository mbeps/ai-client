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
  return <div>{entity} not found</div>;
}
