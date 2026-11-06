import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Props for the InternalToolCard component.
 */
interface InternalToolCardProps {
  /** Tool name as registered with the model. */
  name: string;
  /** Human-readable display name shown prominently. */
  displayName?: string;
  /** One-line summary of what the tool does. */
  description: string;
  /** Condition under which the tool is registered for a chat. */
  availability: string;
}

/**
 * Read-only card describing one internal tool and the condition under which it
 * becomes available to the model. The category is not shown: the page renders
 * one section per category, so repeating it on every card is noise.
 *
 * @param props.name - Tool name as registered with the model.
 * @param props.displayName - Human-readable name displayed prominently.
 * @param props.description - What the tool does.
 * @param props.availability - When the tool is registered.
 * @author Maruf Bepary
 */
export function InternalToolCard({
  name,
  displayName,
  description,
  availability,
}: InternalToolCardProps) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-semibold">
            {displayName ?? name}
          </CardTitle>
          <p className="text-muted-foreground font-mono text-xs">{name}</p>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-muted-foreground px-5 text-sm">
        <span className="text-foreground font-medium">Availability:</span>{" "}
        {availability}
      </CardContent>
    </Card>
  );
}
