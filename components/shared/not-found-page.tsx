import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface NotFoundPageProps {
  title: string;
  description: string;
  linkHref: string;
  linkLabel: string;
  linkIcon?: LucideIcon;
}

/**
 * Shared full-page 404 UI for Next.js not-found.tsx files.
 * Displays a large "404", a title, a description, and a back-navigation button.
 *
 * @param title - Short title (e.g. "Chat not found")
 * @param description - Explanatory text shown below the title
 * @param linkHref - href for the back navigation button
 * @param linkLabel - Label text for the back navigation button
 * @param linkIcon - Optional Lucide icon component for the back navigation button
 */
export function NotFoundPage({
  title,
  description,
  linkHref,
  linkLabel,
  linkIcon: LinkIcon,
}: NotFoundPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <h2 className="text-6xl font-bold text-muted-foreground">404</h2>
      <p className="text-xl font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
      <Button asChild>
        <Link href={linkHref}>
          {LinkIcon && <LinkIcon className="mr-2 h-4 w-4" />}
          {linkLabel}
        </Link>
      </Button>
    </div>
  );
}
