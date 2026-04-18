import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

/**
 * Props for the ChatHistoryCard component.
 *
 * @author Maruf Bepary
 */
interface ChatHistoryCardProps {
  /** Display title of the chat. */
  title: string;
  /** Timestamp of the last activity; shown as a relative time string. */
  updatedAt: Date;
  /** URL to navigate to when the "Continue Chat" button is clicked. */
  href: string;
}

/**
 * Compact card showing a past chat entry with a relative timestamp and a "Continue Chat" link.
 * Used in project and assistant detail pages to list associated chat history.
 *
 * @param props.title - The chat title.
 * @param props.updatedAt - Timestamp of the last message; rendered with `formatDistanceToNow`.
 * @param props.href - Navigation target for the "Continue Chat" button.
 * @author Maruf Bepary
 */
export function ChatHistoryCard({
  title,
  updatedAt,
  href,
}: ChatHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>
          Last active {formatDistanceToNow(updatedAt, { addSuffix: true })}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button variant="secondary" asChild className="w-full">
          <Link href={href}>Continue Chat</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
