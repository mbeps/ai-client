"use client";

import { useAppStore } from "@/lib/store";
import { Command, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptCard } from "@/components/prompt/prompt-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { ROUTES } from "@/constants/routes";
import Link from "next/link";

/**
 * Prompts listing page — client component displaying all user-defined prompt shortcuts.
 * Features: searchable grid of prompt cards (by title/shortcut/content), create new prompt.
 * Prompts are reusable slash-commands (e.g., `/shortcut`) that prepend content to AI calls.
 *
 * @author Maruf Bepary
 */
export default function PromptsPage() {
  const prompts = useAppStore((state) => state.prompts);
  const loadPrompts = useAppStore((state) => state.loadPrompts);

  return (
    <ResourceListPage
      icon={<Command className="h-8 w-8 text-primary" />}
      title="Prompts"
      description="Custom shortcuts for your frequently used instructions."
      items={prompts}
      renderCard={(prompt) => <PromptCard prompt={prompt} />}
      emptyStateMessage="No prompts yet. Create one to define a custom prompt shortcut."
      searchPlaceholder="Search prompts..."
      onMount={loadPrompts}
      action={
        <Button asChild className="w-full md:w-auto">
          <Link href={ROUTES.SETTINGS.PROMPTS.new}>
            <Plus className="h-4 w-4 mr-2" />
            New Prompt
          </Link>
        </Button>
      }
      filterFn={(p, q) =>
        p.title.toLowerCase().includes(q.toLowerCase()) ||
        p.shortcut.toLowerCase().includes(q.toLowerCase()) ||
        p.content.toLowerCase().includes(q.toLowerCase())
      }
    />
  );
}
