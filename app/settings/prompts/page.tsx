"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Command, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptCard } from "@/components/prompt/prompt-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { CreatePromptDialog } from "./_components/create-prompt-dialog";

export default function PromptsPage() {
  const prompts = useAppStore((state) => state.prompts);
  const loadPrompts = useAppStore((state) => state.loadPrompts);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
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
          <Button onClick={() => setDialogOpen(true)} className="w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Prompt
          </Button>
        }
        filterFn={(p, q) =>
          p.title.toLowerCase().includes(q.toLowerCase()) ||
          p.shortcut.toLowerCase().includes(q.toLowerCase()) ||
          p.content.toLowerCase().includes(q.toLowerCase())
        }
      />
      <CreatePromptDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
