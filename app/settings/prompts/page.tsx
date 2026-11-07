"use client";

import { Command, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PromptCard } from "@/components/prompt/prompt-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { sortByTitle } from "@/lib/sort-by-name";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Prompts listing page — client component displaying all user-defined prompt shortcuts.
 * Features: searchable grid of prompt cards (by title/shortcut/content), scope filtering, create new prompt.
 * Prompts are reusable slash-commands (e.g., `/shortcut`) that prepend content to AI calls.
 * Displays prompts in alphabetical order by title to maintain stable card placement during updates.
 *
 * @author Maruf Bepary
 */
export default function PromptsPage() {
  const prompts = useAppStore((state) => state.prompts);
  const loadPrompts = useAppStore((state) => state.loadPrompts);
  const [scopeFilter, setScopeFilter] = useState<
    "all" | "global" | "project" | "assistant"
  >("all");

  return (
    <ResourceListPage
      icon={<Command className="text-primary h-8 w-8" />}
      title="Prompts"
      description="Custom shortcuts for your frequently used instructions."
      items={prompts}
      columns={2}
      renderCard={(prompt) => <PromptCard prompt={prompt} />}
      emptyStateMessage="No prompts yet. Create one to define a custom prompt shortcut."
      searchPlaceholder="Search prompts..."
      onMount={loadPrompts}
      sortFn={sortByTitle}
      action={
        <Button asChild className="w-full md:w-auto">
          <Link href={ROUTES.SETTINGS.PROMPTS.new}>
            <Plus className="mr-2 h-4 w-4" />
            New Prompt
          </Link>
        </Button>
      }
      extraFilters={
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(["all", "global", "project", "assistant"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={scopeFilter === s ? "default" : "outline"}
              className="h-8 text-xs capitalize"
              onClick={() => setScopeFilter(s)}
            >
              {s === "all"
                ? "All"
                : s === "global"
                  ? "Global"
                  : s === "project"
                    ? "Projects"
                    : "Assistants"}
            </Button>
          ))}
        </div>
      }
      customFilterFn={(p) => {
        if (scopeFilter === "global") return !p.projectId && !p.assistantId;
        if (scopeFilter === "project") return Boolean(p.projectId);
        if (scopeFilter === "assistant") return Boolean(p.assistantId);
        return true;
      }}
      filterFn={(p, q) =>
        p.title.toLowerCase().includes(q.toLowerCase()) ||
        p.shortcut.toLowerCase().includes(q.toLowerCase()) ||
        p.content.toLowerCase().includes(q.toLowerCase())
      }
    />
  );
}
