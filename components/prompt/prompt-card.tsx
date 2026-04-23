"use client";

import { Card } from "@/components/ui/card";
import { Command } from "lucide-react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import type { Prompt } from "@/types/prompt";
import { PromptOptions } from "./prompt-options";
import { Badge } from "@/components/ui/badge";

/**
 * Props for the PromptCard component.
 *
 * @author Maruf Bepary
 */
interface PromptCardProps {
  /** The prompt entity to display. */
  prompt: Prompt;
}

/**
 * Card representing a single prompt in the prompts listing page.
 * Navigates to the prompt detail page on click and shows an options menu.
 *
 * @param props.prompt - The prompt to display.
 * @author Maruf Bepary
 */
export function PromptCard({ prompt }: PromptCardProps) {
  const router = useRouter();

  return (
    <Card
      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer group flex flex-col justify-between min-h-[80px]"
      onClick={() => router.push(ROUTES.SETTINGS.PROMPTS.detail(prompt.id))}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Command className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-semibold leading-none truncate">
                {prompt.title}
              </h3>
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary" className="font-mono text-[10px] py-0">
                {prompt.shortcut.startsWith("/")
                  ? prompt.shortcut
                  : `/${prompt.shortcut}`}
              </Badge>
            </div>
            {/* <p className="text-sm text-muted-foreground line-clamp-2">
              {prompt.content}
            </p> */}
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <PromptOptions prompt={prompt} />
        </div>
      </div>
    </Card>
  );
}
