"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import type { Prompt } from "@/types/prompt/prompt";
import { PromptOptions } from "./prompt-options";

/**
 * Props for the PromptCard component.
 *
 */
interface PromptCardProps {
  /** The prompt entity containing id, title, shortcut, and content for display. */
  prompt: Prompt;
}

/**
 * Card displaying prompt title, slash-command shortcut badge, and command icon for prompts listing page.
 * Clicking the card navigates to prompt detail/edit page; options menu provides Edit, Rename, and Delete actions.
 * Shortcut displayed as `/command` monospace badge for quick visual identification of command syntax.
 *
 * @param props.prompt - Prompt entity with title, shortcut, and content metadata.
 * @see PromptOptions for menu actions including rename and content editing.
 */
export function PromptCard({ prompt }: PromptCardProps) {
  return (
    <Link
      href={ROUTES.SETTINGS.PROMPTS.detail(prompt.id)}
      className="group block h-full focus-visible:outline-none"
    >
      <Card className="flex h-full min-h-[80px] cursor-pointer flex-col justify-between p-4 transition-colors hover:bg-muted/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate font-semibold leading-none">
                  {prompt.title}
                </h3>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge
                  variant="secondary"
                  className="py-0 font-mono text-[10px]"
                >
                  {prompt.shortcut.startsWith("/")
                    ? prompt.shortcut
                    : `/${prompt.shortcut}`}
                </Badge>
              </div>
            </div>
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <PromptOptions prompt={prompt} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
