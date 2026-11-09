"use client";

import { Bot, Plus } from "lucide-react";
import Link from "next/link";
import { AssistantCard } from "@/components/assistant/assistant-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store/use-app-store";

/**
 * Assistants list page for browsing and managing AI personas.
 * Route: /assistants. Searchable grid linking to the dedicated assistant creator.
 * Protected route — requires active authentication. Loads assistants on mount via Zustand.
 *
 * @returns Searchable list of assistant cards with creation and management options.
 * @see ChatPageClient to use an assistant in a chat conversation.
 * @author Maruf Bepary
 */
export default function AssistantsPage() {
  const assistants = useAppStore((state) => state.assistants);
  const loadAssistants = useAppStore((state) => state.loadAssistants);

  return (
    <ResourceListPage
      icon={<Bot className="text-primary h-8 w-8" />}
      title="Assistants"
      description="Custom AI personas tailored for specific tasks."
      items={assistants}
      renderCard={(assistant) => <AssistantCard assistant={assistant} />}
      emptyStateMessage="No assistants yet. Create one to define a custom AI persona."
      searchPlaceholder="Search assistants..."
      onMount={loadAssistants}
      action={
        <Button asChild className="w-full md:w-auto">
          <Link href={ROUTES.ASSISTANTS.new}>
            <Plus className="mr-2 h-4 w-4" />
            Create Assistant
          </Link>
        </Button>
      }
      filterFn={(a, q) =>
        a.name.toLowerCase().includes(q.toLowerCase()) ||
        a.description.toLowerCase().includes(q.toLowerCase())
      }
    />
  );
}
