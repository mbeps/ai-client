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
 * @param props.description - What the tool does.
 * @param props.availability - When the tool is registered.
 */
export function InternalToolCard({
  name,
  description,
  availability,
}: InternalToolCardProps) {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <CardTitle className="font-mono text-base">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 text-muted-foreground text-sm">
        <span className="font-medium text-foreground">Availability:</span>{" "}
        {availability}
      </CardContent>
    </Card>
  );
}
