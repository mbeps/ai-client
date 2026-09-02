"use client";

import { Bot, Plus } from "lucide-react";
import { useState } from "react";
import { AssistantCard } from "@/components/assistant/assistant-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { CreateAssistantDialog } from "./_components/create-assistant-dialog";

/**
 * Assistants list page for browsing and managing AI personas.
 * Route: /assistants. Searchable grid with create dialog for custom AI personalities.
 * Protected route — requires active authentication. Loads assistants on mount via Zustand.
 *
 * @returns Searchable list of assistant cards with creation and management options.
 * @see ChatPageClient to use an assistant in a chat conversation.
 */
export default function AssistantsPage() {
  const assistants = useAppStore((state) => state.assistants);
  const loadAssistants = useAppStore((state) => state.loadAssistants);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <ResourceListPage
        icon={<Bot className="h-8 w-8 text-primary" />}
        title="Assistants"
        description="Custom AI personas tailored for specific tasks."
        items={assistants}
        renderCard={(assistant) => <AssistantCard assistant={assistant} />}
        emptyStateMessage="No assistants yet. Create one to define a custom AI persona."
        searchPlaceholder="Search assistants..."
        onMount={loadAssistants}
        action={
          <Button
            onClick={() => setDialogOpen(true)}
            className="w-full md:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Assistant
          </Button>
        }
        filterFn={(a, q) =>
          a.name.toLowerCase().includes(q.toLowerCase()) ||
          a.description.toLowerCase().includes(q.toLowerCase())
        }
      />
      <CreateAssistantDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
